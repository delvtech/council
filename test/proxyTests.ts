import "module-alias/register";

import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

import { MockTokenLogic } from "../typechain/MockTokenLogic";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Storage } from "../typechain/Storage";
import { BigNumberish, BigNumber } from "ethers";
import { SimpleProxy } from "../typechain/SimpleProxy";

const { provider } = waffle;

// see https://docs.soliditylang.org/en/v0.8.4/internals/layout_in_storage.html?highlight=storage%20layout
function addressToStoragePointer(pointer: BigNumberish, address: string) {
  const toBeHashed = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint256"],
    [address, pointer]
  );
  return ethers.utils.keccak256(toBeHashed);
}

describe("erc20", function () {
  let token: MockTokenLogic;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];

  before(async function () {
    await createSnapshot(provider);
    signers = await ethers.getSigners();
    const deployer = await ethers.getContractFactory(
      "MockTokenLogic",
      signers[0]
    );
    token = await deployer.deploy(signers[0].address);
    await token.mint(signers[0].address, ethers.utils.parseEther("100"));
  });
  after(async () => {
    await restoreSnapshot(provider);
  });

  describe("transfer functionality", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it("transfers successfully", async () => {
      await token.transfer(signers[1].address, ethers.utils.parseEther("5"));
      expect(await token.balanceOf(signers[0].address)).to.be.eq(
        ethers.utils.parseEther("95")
      );
      expect(await token.balanceOf(signers[1].address)).to.be.eq(
        ethers.utils.parseEther("5")
      );
    });
    it("does not transfer more than balance", async () => {
      const tx = token.transfer(
        signers[1].address,
        ethers.utils.parseEther("500")
      );
      await expect(tx).to.be.reverted;
    });
  });
  describe("storage consistency checks", async () => {
    let storageLib: Storage;

    before(async function () {
      const storageFactory = await ethers.getContractFactory(
        "Storage",
        signers[0]
      );
      storageLib = await storageFactory.deploy();
    });

    it("Does not store anything in the first 100 slots", async () => {
      for (let i = 0; i < 100; i++) {
        expect(await token.readStorage(i)).to.be.deep.eq(
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        );
      }
    });
    it("Stores the owner and total supply correctly", async () => {
      expect(
        await token.readStorage(await storageLib.getPtr("address", "owner"))
      ).to.be.eq(
        "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266"
      );

      expect(
        BigNumber.from(
          await token.readStorage(
            await storageLib.getPtr("uint256", "totalSupply")
          )
        )
      ).to.be.eq(ethers.utils.parseEther("100"));
    });
    it("Stores the balance in the correct location", async () => {
      const balancesPtr = await storageLib.getPtr(
        "mapping(address => uint256)",
        "balances"
      );

      expect(
        BigNumber.from(
          await token.readStorage(
            addressToStoragePointer(balancesPtr, signers[0].address)
          )
        )
      ).to.be.eq(ethers.utils.parseEther("100"));
    });
    it("doesn't store to a balances mapping in any of the first 100 slots", async () => {
      for (let i = 0; i < 100; i++) {
        expect(
          await token.readStorage(
            addressToStoragePointer(i, signers[0].address)
          )
        ).to.be.eq(
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        );
      }
    });
  });

  describe("Functions as an erc20 through proxy", async () => {
    let proxyToken: MockTokenLogic;
    let proxy: SimpleProxy;

    before(async () => {
      const proxyFactory = await ethers.getContractFactory(
        "SimpleProxy",
        wallet
      );
      proxy = await proxyFactory.deploy(wallet.address, token.address);

      const tokenFactory = await ethers.getContractFactory(
        "MockTokenLogic",
        wallet
      );
      proxyToken = tokenFactory.attach(proxy.address);
    });

    it("Works as a token contract", async () => {
      // Try minting some
      await proxyToken.increaseBalance(
        wallet.address,
        ethers.utils.parseEther("10")
      );
      expect(
        await proxyToken.connect(wallet).balanceOf(wallet.address)
      ).to.be.eq(ethers.utils.parseEther("10"));
      // Try transferring some
      await proxyToken.transfer(
        signers[1].address,
        ethers.utils.parseEther("5")
      );
      expect(await proxyToken.balanceOf(wallet.address)).to.be.eq(
        ethers.utils.parseEther("5")
      );
      expect(await proxyToken.balanceOf(signers[1].address)).to.be.eq(
        ethers.utils.parseEther("5")
      );
      // We check that the state is in the proxy not the logic contract
      // 100 eth balance is because we mint in the before of the tests
      expect(await token.connect(wallet).balanceOf(wallet.address)).to.be.eq(
        ethers.utils.parseEther("100")
      );
      expect(
        await token.connect(wallet).balanceOf(signers[1].address)
      ).to.be.eq(0);
    });

    it("Allows resetting implementation", async () => {
      // Call implementation reset at the owner
      await proxy
        .connect(signers[0])
        .upgradeProxy("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
      expect(await proxy.proxyImplementation()).to.be.eq(
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
      );
    });

    it("Blocks resetting implementation from unauthorized address", async () => {
      // Call implementation reset at the owner
      const tx = proxy
        .connect(signers[1])
        .upgradeProxy("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
      await expect(tx).to.be.revertedWith("unauthorized");
    });

    it("Allows resetting owner", async () => {
      // Call implementation reset at the owner
      await proxy.connect(signers[0]).resetProxyOwner(signers[1].address);
      expect(await proxy.proxyGovernance()).to.be.eq(signers[1].address);
      // We check that we can do it again
      await proxy.connect(signers[1]).resetProxyOwner(signers[2].address);
    });

    it("Blocks resetting owner from unauthorized address", async () => {
      // Call implementation reset at the owner
      const tx = proxy.connect(signers[1]).resetProxyOwner(signers[1].address);
      await expect(tx).to.be.revertedWith("unauthorized");
    });
  });
});
