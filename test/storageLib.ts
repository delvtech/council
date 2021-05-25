import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

import { MockTokenLogic } from "../typechain/MockTokenLogic";
import { MockTokenLogic__factory } from "../typechain/factories/MockTokenLogic__Factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Storage } from "../typechain/Storage";
import { Storage__factory } from "../typechain/factories/Storage__factory";
import { BigNumberish, BigNumber } from "ethers";

const { provider } = waffle;

function addressToStoragePointer(pointer: BigNumberish, address: string) {
  console.log(
    ethers.utils.solidityPack(["uint256", "address"], [pointer, address])
  );
  return ethers.utils.solidityKeccak256(
    ["uint256", "address"],
    [pointer, address]
  );
}

describe("erc20", function () {
  let token: MockTokenLogic;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];

  before(async function () {
    await createSnapshot(provider);
    signers = await ethers.getSigners();
    const deployer = new MockTokenLogic__factory(signers[0]);
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
      const storageFactory = new Storage__factory(signers[0]);
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
        ).to.be.eq();
      }
    });
  });
});
