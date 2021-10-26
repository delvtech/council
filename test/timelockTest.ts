import "module-alias/register";

import { expect } from "chai";
import { BytesLike } from "ethers";
import { ethers, waffle } from "hardhat";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Timelock } from "typechain";
import timelockData from "../artifacts/contracts/features/Timelock.sol/Timelock.json";

const { provider } = waffle;

export async function createCallHash(calldata: BytesLike[], targets: string[]) {
  const toBeHashed = ethers.utils.defaultAbiCoder.encode(
    ["address[]", "bytes[]"],
    [targets, calldata]
  );
  return ethers.utils.keccak256(toBeHashed);
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
    timelock = await deployer.deploy(0, signers[0].address, signers[1].address);
  });

  after(async () => {
    await restoreSnapshot(provider);
  });

  beforeEach(async () => {
    await createSnapshot(provider);
  });
  afterEach(async () => {
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
      // execute again to check against the new wait time
      await timelock.connect(signers[0]).registerCall(callHash);
      const tx = timelock
        .connect(signers[0])
        .execute([timelock.address], [calldata]);

      await expect(tx).to.be.revertedWith("not enough time has passed");
    });

    it("fails if call not registered", async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678ffffffff"];
      const callHash = await createCallHash(calldata, [timelock.address]);

      const call = await timelock.callTimestamps(callHash);
      expect(call).to.be.eq(0);
      const tx = timelock
        .connect(signers[0])
        .execute([timelock.address], calldata);
      await expect(tx).to.be.revertedWith("call has not been initialized");
    });

    it("fail if executed twice", async () => {
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
      const tx = timelock
        .connect(signers[0])
        .execute([timelock.address], [calldata]);
      await expect(tx).to.be.revertedWith("call has not been initialized");
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

      // Check that state has been restored after successful execute
      const call = await timelock.callTimestamps(callHash);
      expect(call).to.be.eq(0);
    });
  });

  describe("increase time", () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    let callHash: string;

    before(async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678ffffffff"];
      callHash = await createCallHash(calldata, [timelock.address]);

      // Register the call for execution
      await timelock.registerCall(callHash);
    });

    it("fails if not authorized", async () => {
      const tx = timelock.connect(signers[0]).increaseTime(1000, callHash);
      await expect(tx).to.be.revertedWith("Sender not Authorized");
    });

    it("fails if attempted more than once", async () => {
      await timelock.connect(signers[1]).increaseTime(1234, callHash);
      const tx = timelock.connect(signers[1]).increaseTime(5678, callHash);
      await expect(tx).to.be.revertedWith("value can only be changed once");
    });

    it("successful time increase", async () => {
      await timelock.connect(signers[1]).increaseTime(1234, callHash);
      const blockNum = await provider.getBlockNumber();
      const block = await provider.getBlock(blockNum);
      const { timestamp } = block;
      const call = await timelock.callTimestamps(callHash);
      expect(call).to.be.eq(timestamp + 1234 - 1);
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
      await expect(tx).to.be.revertedWith("Sender not owner");
    });

    it("successful call register", async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678fffffffe"];
      const callHash = await createCallHash(calldata, [timelock.address]);
      await timelock.connect(signers[0]).registerCall(callHash);
      const call = await timelock.callTimestamps(callHash);
      expect(call).to.not.eq(0);
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
      await expect(tx).to.be.revertedWith("Sender not owner");
    });

    it("successful call stop", async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678fffffffe"];
      const callHash = await createCallHash(calldata, [timelock.address]);
      await timelock.connect(signers[0]).registerCall(callHash);
      await timelock.connect(signers[0]).stopCall(callHash);
      const call = await timelock.callTimestamps(callHash);
      expect(call).to.be.eq(0);
    });

    it("doesn't register twice", async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678fffffffe"];
      const callHash = await createCallHash(calldata, [timelock.address]);
      await timelock.connect(signers[0]).registerCall(callHash);
      const tx = timelock.registerCall(callHash);
      await expect(tx).to.be.revertedWith("already registered");
    });

    it("doesn't stop on an already empty call", async () => {
      const calldata = ["0x12345678ffffffff", "0x12345678fffffffe"];
      const callHash = await createCallHash(calldata, [timelock.address]);
      const tx = timelock.stopCall(callHash);
      await expect(tx).to.be.revertedWith("No call to be removed");
    });
  });
});
