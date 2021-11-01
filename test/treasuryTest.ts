import "module-alias/register";

import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumberish, BigNumber } from "ethers";
import { TestTreasury } from "../typechain/TestTreasury";
import { MockERC20 } from "../typechain/MockERC20";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import targetData from "../artifacts/contracts/mocks/TestTreasury.sol/TestTreasury.json";

const { provider } = waffle;

describe("Treasury", function () {
  // We use the history tracker and signers in each test
  let treasury: TestTreasury;
  let token: MockERC20;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  const amount: BigNumber = ethers.utils.parseEther("10");

  before(async function () {
    // Create a before snapshot
    await createSnapshot(provider);

    signers = await ethers.getSigners();

    // deploy the token;
    const erc20Deployer = await ethers.getContractFactory(
      "MockERC20",
      signers[0]
    );
    token = await erc20Deployer.deploy("Ele", "test ele", signers[0].address);

    // deploy the treasury
    const deployer = await ethers.getContractFactory(
      "TestTreasury",
      signers[0]
    );

    treasury = await deployer.deploy(signers[0].address);

    await token.setBalance(treasury.address, amount);
    await wallet.sendTransaction({ to: treasury.address, value: amount });
  });
  // After we reset our state in the fork
  after(async () => {
    await restoreSnapshot(provider);
  });
  // Before each we snapshot
  beforeEach(async () => {
    await createSnapshot(provider);
  });
  // After we reset our state in the fork
  afterEach(async () => {
    await restoreSnapshot(provider);
  });
  describe("sendFunds", async () => {
    // Before each we snapshot
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    // After we reset our state in the fork
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not owner", async () => {
      const tx = treasury
        .connect(signers[1])
        .sendFunds(token.address, 1000, signers[1].address);
      await expect(tx).to.be.revertedWith("Sender not owner");
    });
    it("correctly transfers ERC20", async () => {
      await treasury
        .connect(signers[0])
        .sendFunds(token.address, 1000, signers[1].address);
      const balance = await token.balanceOf(signers[1].address);
      expect(balance).to.eq(1000);
    });
    it("correctly transfers ETH", async () => {
      const balanceInit = await provider.getBalance(signers[1].address);

      await treasury
        .connect(signers[0])
        .sendFunds(
          "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          1000,
          signers[1].address
        );

      const balanceFin = await provider.getBalance(signers[1].address);
      expect(balanceFin).to.eq(balanceInit.add(1000));
    });
  });
  describe("approve", async () => {
    // Before each we snapshot
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    // After we reset our state in the fork
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not owner", async () => {
      const tx = treasury
        .connect(signers[1])
        .approve(token.address, signers[1].address, 1000);
      await expect(tx).to.be.revertedWith("Sender not owner");
    });
    it("correctly approves", async () => {
      await treasury
        .connect(signers[0])
        .approve(token.address, signers[1].address, 1000);
      const allowance = await token.allowance(
        treasury.address,
        signers[1].address
      );
      expect(allowance).to.eq(1000);
    });
  });
  describe("genericCall", async () => {
    // Before each we snapshot
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    // After we reset our state in the fork
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not owner", async () => {
      const tx = treasury
        .connect(signers[1])
        .genericCall(token.address, "0x12341234");
      await expect(tx).to.be.revertedWith("Sender not owner");
    });
    it("correctly performs generic call", async () => {
      const newDummyVal = 10000;
      const targerInterface = new ethers.utils.Interface(targetData.abi);
      const calldata = targerInterface.encodeFunctionData("updateDummy", [
        newDummyVal,
      ]);

      await treasury
        .connect(signers[0])
        .genericCall(treasury.address, calldata);

      const dummy = await treasury.dummy();
      expect(dummy).to.eq(newDummyVal);
    });
  });
});
