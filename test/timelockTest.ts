import "module-alias/register";

import { expect } from "chai";
import { Signer } from "ethers";
import { ethers, waffle } from "hardhat";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Timelock } from "typechain";

const { provider } = waffle;

describe("Timelock", () => {
  let timelock: Timelock;

  let signers: SignerWithAddress[];

  async function getBlock() {
    return (await ethers.provider.getBlock("latest")).number;
  }

  before(async () => {
    await createSnapshot(provider);
    signers = await ethers.getSigners();

    const deployer = await ethers.getContractFactory("Timelock", signers[0]);
    timelock = await deployer.deploy(0, signers[0].address);
  });

  after(async () => {
    await restoreSnapshot(provider);
  });

  describe("execute", () => {
    it("fails to execute with bad data", async () => {
      const badcalldata = ["0xBAD45678ffffffff", "0x12345678ffffffff"];
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const callHash =
        "0x4bf388daaa919de3acb4d3fefb194e5af0403dcaea5ab842d09cfa8c76fdf8eb";

      const tx = timelock
        .connect(signers[0])
        .execute(callHash, targets, badcalldata);
      await expect(tx).to.be.revertedWith("hash mismatch");
    });

    it("fails to execute prematurely", async () => {
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const callHash =
        "0xb7ec49e53dd1ba1fbe652d46a161ca1487239a94da35929d38669d3e90b9fcbf";
      await timelock.connect(signers[0]).registerCall(callHash);
      await timelock.connect(signers[0]).setWaitTime(10000000000000);

      const tx = timelock
        .connect(signers[0])
        .execute(callHash, targets, calldatas);
      await expect(tx).to.be.revertedWith("not enough time has passed");
    });
  });

  // describe("execute", () => {
  //   it("fails to execute with bad data", async () => {
  //     const baddata = "0xBAD45678ffffffff";
  //     const target = ethers.constants.AddressZero;
  //     const callHash =
  //       "0x4bf388daaa919de3acb4d3fefb194e5af0403dcaea5ab842d09cfa8c76fdf8eb";

  //     const tx = timelock
  //       .connect(signers[0])
  //       .execute(callHash, target, baddata);
  //     await expect(tx).to.be.revertedWith("hash mismatch");
  //   });

  //   it("fails to execute prematurely", async () => {
  //     const calldata = "0x12345678ffffffff";
  //     const target = ethers.constants.AddressZero;
  //     const callHash =
  //       "0x4bf388daaa919de3acb4d3fefb194e5af0403dcaea5ab842d09cfa8c76fdf8eb";

  //     await timelock.connect(signers[0]).registerCall(callHash);
  //     await timelock.connect(signers[0]).setWaitTime(10000000000000);

  //     const tx = timelock
  //       .connect(signers[0])
  //       .execute(callHash, target, calldata);
  //     await expect(tx).to.be.revertedWith("not enough time has passed");
  //   });

  //   it("executes correctly", async () => {
  //     const calldata = "0x12345678ffffffff";
  //     const target = ethers.constants.AddressZero;
  //     const callHash =
  //       "0x4bf388daaa919de3acb4d3fefb194e5af0403dcaea5ab842d09cfa8c76fdf8eb";

  //     await timelock.connect(signers[0]).registerCall(callHash);
  //     await timelock.connect(signers[0]).setWaitTime(0);

  //     const tx = timelock
  //       .connect(signers[0])
  //       .execute(callHash, target, calldata);
  //     // not sure what we should expect here
  //   });
  // });
});
