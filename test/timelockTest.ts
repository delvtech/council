import "module-alias/register";

import { expect } from "chai";
import { Bytes, BytesLike, Signer } from "ethers";
import { ethers, waffle } from "hardhat";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TestTimelock } from "typechain";
import timelockData from "../artifacts/contracts/mocks/TestTimelock.sol/TestTimelock.json";
import { BigNumberish } from "ethers";

const { provider } = waffle;

export async function createCallHash(calldata: BytesLike[], targets: string[]) {
  return ethers.utils.solidityKeccak256(
    ["address[]", "bytes[]"],
    [targets, calldata]
  );
}

describe("Timelock", () => {
  let timelock: TestTimelock;

  let signers: SignerWithAddress[];

  async function getBlock() {
    return (await ethers.provider.getBlock("latest")).number;
  }

  before(async () => {
    await createSnapshot(provider);
    signers = await ethers.getSigners();

    const deployer = await ethers.getContractFactory(
      "TestTimelock",
      signers[0]
    );
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
      const newDummyValue = 10000;
      const tInterface = new ethers.utils.Interface(timelockData.abi);
      const calldata = tInterface.encodeFunctionData("updateDummy", [
        newDummyValue,
      ]);

      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];

      const callHash = await createCallHash([calldata], targets);

      await timelock.connect(signers[0]).registerCall(callHash);
      await timelock.connect(signers[0]).setWaitTime(10000000000000);

      const tx = timelock.connect(signers[0]).execute(targets, [calldata]);
      await expect(tx).to.be.revertedWith("not enough time has passed");
    });
  });
});
