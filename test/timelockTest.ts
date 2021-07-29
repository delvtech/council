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
    timelock = await deployer.deploy(0, ethers.constants.AddressZero);
  });

  after(async () => {
    await restoreSnapshot(provider);
  });

  it("fails to execute with bad data", async () => {
    const baddata = "0xBAD45678ffffffff";
    const target = ethers.constants.AddressZero;
    const callHash =
      "0x4bf388daaa919de3acb4d3fefb194e5af0403dcaea5ab842d09cfa8c76fdf8eb";

    const tx = timelock.connect(signers[0]).execute(callHash, target, baddata);
    await expect(tx).to.be.revertedWith("hash mismatch");
  });
});
