import "module-alias/register";

import { expect } from "chai";
import { Bytes, BytesLike, Signer } from "ethers";
import { ethers, waffle } from "hardhat";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Timelock } from "typechain";
import timelockData from "../artifacts/contracts/features/Timelock.sol/Timelock.json";
import { BigNumberish } from "ethers";

const { provider } = waffle;

export async function createCallHash(calldata: BytesLike[], targets: string[]) {
  return ethers.utils.solidityKeccak256(
    ["address[]", "bytes[]"],
    [targets, calldata]
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it("fails to execute prematurely", async () => {
      const newWaitTime = 100000000000000;
      const tInterface = new ethers.utils.Interface(timelockData.abi);
      const calldata = tInterface.encodeFunctionData("setWaitTime", [
        newWaitTime,
      ]);

      const callHash = await createCallHash([calldata], [timelock.address]);

      await timelock.connect(signers[0]).registerCall(callHash);
      // execute once to update wait time through the execute function
      await timelock
        .connect(signers[0])
        .execute([timelock.address], [calldata]);
      // execute again to check against the new waittime
      const tx = timelock
        .connect(signers[0])
        .execute([timelock.address], [calldata]);

      await expect(tx).to.be.revertedWith("not enough time has passed");
    });

    it("successful execution", async () => {
      const newWaitTime = 10000;
      const tInterface = new ethers.utils.Interface(timelockData.abi);
      const calldata = tInterface.encodeFunctionData("setWaitTime", [
        newWaitTime,
      ]);

      const callHash = await createCallHash([calldata], [timelock.address]);

      await timelock.connect(signers[0]).registerCall(callHash);
      await delay(1000);
      await timelock
        .connect(signers[0])
        .execute([timelock.address], [calldata]);

      const w = await timelock.waitTime();
      expect(w).to.be.eq(newWaitTime);
    });
  });

  describe("increase time", () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it("fails if not authorized", async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678ffffffff"];
      const callHash = await createCallHash(calldata, [timelock.address]);

      const tx = timelock.connect(signers[1]).increaseTime(1000, callHash);
      await expect(tx).to.be.revertedWith("Sender not Authorized");
    });

    it("fails if attempted more than once", async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678ffffffff"];
      const callHash = await createCallHash(calldata, [timelock.address]);

      await timelock.connect(signers[0]).increaseTime(1234, callHash);
      const tx = timelock.connect(signers[0]).increaseTime(5678, callHash);
      await expect(tx).to.be.revertedWith("value can only be changed once");
    });
  });

  describe("register call", () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it("fails if not governance", async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678ffffffff"];
      const callHash = await createCallHash(calldata, [timelock.address]);

      const tx = timelock.connect(signers[1]).registerCall(callHash);
      await expect(tx).to.be.revertedWith("contract must be governance");
    });
  });

  describe("stop call", () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it("fails if not governance", async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678ffffffff"];
      const callHash = await createCallHash(calldata, [timelock.address]);

      const tx = timelock.connect(signers[1]).stopCall(callHash);
      await expect(tx).to.be.revertedWith("contract must be governance");
    });
  });
});
