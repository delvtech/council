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

// see https://docs.soliditylang.org/en/v0.8.4/internals/layout_in_storage.html?highlight=storage%20layout
function createCallHash(calldata: BigNumberish, addresses: string) {
  console.log("here1");
  const toBeHashed = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint256"],
    [addresses, calldata]
  );
  return ethers.utils.keccak256(toBeHashed);
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
    // it("fails to execute with bad data", async () => {
    //   const badcalldata = ["0xBAD45678ffffffff", "0x12345678ffffffff"];
    //   const targets = [
    //     ethers.constants.AddressZero,
    //     ethers.constants.AddressZero,
    //   ];
    //   const callHash =
    //     "0x4bf388daaa919de3acb4d3fefb194e5af0403dcaea5ab842d09cfa8c76fdf8eb";

    //   const tx = timelock
    //     .connect(signers[0])
    //     .execute(targets, badcalldata);
    //   await expect(tx).to.be.revertedWith("hash mismatch");
    // });

    it("fails to execute prematurely", async () => {
      const newDummyValue = 10000;
      const tInterface = new ethers.utils.Interface(timelockData.abi);
      const calldata = tInterface.encodeFunctionData("updateDummy", [
        newDummyValue,
      ]);

      const target = ethers.constants.AddressZero;

      const callHash = createCallHash(0, target);
      console.log(callHash);

      await timelock.connect(signers[0]).registerCall(callHash);
      await timelock.connect(signers[0]).setWaitTime(10000000000000);

      const tx = timelock.connect(signers[0]).execute([target], [calldata]);
      await expect(tx).to.be.revertedWith("not enough time has passed");
    });
  });
});
