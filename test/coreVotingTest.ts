import "module-alias/register";

import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

import { CoreVoting } from "typechain/CoreVoting";
import { MockVotingVault } from "typechain/MockVotingVault";
import { MockTimelock } from "typechain/MockTimelock";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Storage } from "typechain/Storage";
import { BigNumberish, BigNumber } from "ethers";
import { SimpleProxy } from "typechain/SimpleProxy";

const { provider } = waffle;

describe("CoreVoting", function () {
  let coreVoting: CoreVoting;
  const votingVaults: Array<string> = new Array<string>();
  let timelock: MockTimelock;
  const baseVotingPower = 1e10;

  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];

  async function getBlock() {
    return (await ethers.provider.getBlock("latest")).number;
  }

  before(async function () {
    await createSnapshot(provider);
    signers = await ethers.getSigners();

    const votingVaultDeployer = await ethers.getContractFactory(
      "MockVotingVault",
      signers[0]
    );
    const timelovkDeployer = await ethers.getContractFactory(
      "MockTimelock",
      signers[0]
    );
    const coreVotingDeployer = await ethers.getContractFactory(
      "TestCoreVoting",
      signers[0]
    );
    // deploy 3 voting vaults and set signer voting power
    for (let i = 0; i < 3; i++) {
      const votingVault = await votingVaultDeployer.deploy();
      await votingVault.setVotingPower(signers[0].address, baseVotingPower);
      await votingVault.setVotingPower(signers[1].address, baseVotingPower);
      await votingVault.setVotingPower(signers[2].address, baseVotingPower);
      votingVaults.push(votingVault.address);
    }
    timelock = await timelovkDeployer.deploy();
    coreVoting = await coreVotingDeployer.deploy(
      timelock.address,
      0,
      0,
      0,
      votingVaults
    );
  });
  after(async () => {
    await restoreSnapshot(provider);
  });

  describe("proposal", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("correctly creates a new proposal", async () => {
      const block = await getBlock();

      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, targets, calldatas, 0);

      const proposal = await coreVoting.getProposalData(0);

      expect(proposal[1]).to.be.eq(block + 1);
      expect(proposal[2]).to.be.eq(block + 1);
      expect(proposal[3]).to.be.eq(0);
      expect(proposal[4]).to.be.eq(true);
      expect(proposal[5][0]).to.be.eq(baseVotingPower * 3);
      expect(proposal[5][1]).to.be.eq(0);
      expect(proposal[5][2]).to.be.eq(0);
    });
  });
  describe("vote", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to vote with unapproved voting vault", async () => {
      votingVaults.push(ethers.constants.AddressZero);
      const tx = coreVoting.connect(signers[1]).vote(votingVaults, 0, 0);
      await expect(tx).to.be.revertedWith("unverified vault");
      votingVaults.pop();
    });
    it("fails to vote with duplicate voting vault", async () => {
      votingVaults.push(votingVaults[0]);
      const tx = coreVoting.connect(signers[1]).vote(votingVaults, 0, 0);
      await expect(tx).to.be.revertedWith("duplicate vault");
      votingVaults.pop();
    });
    it("correctly votes on a new proposal", async () => {
      const block = await getBlock();

      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, targets, calldatas, 0);

      // proposal was with a yes vote. Match no votes.
      await coreVoting.connect(signers[1]).vote(votingVaults, 0, 1);

      const proposal = await coreVoting.getProposalData(0);

      expect(proposal[1]).to.be.eq(block + 1);
      expect(proposal[2]).to.be.eq(block + 1);
      expect(proposal[3]).to.be.eq(0);
      expect(proposal[4]).to.be.eq(true);
      expect(proposal[5][0]).to.be.eq(baseVotingPower * 3);
      expect(proposal[5][1]).to.be.eq(baseVotingPower * 3);
      expect(proposal[5][2]).to.be.eq(0);
    });
  });
  describe("execute", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to execute with bad data", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];
      const badcalldata = ["0xBAD45678ffffffff", "0x12345678ffffffff"];

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, targets, calldatas, 0);

      // pass proposal with 2/3 majority
      await coreVoting.connect(signers[1]).vote(votingVaults, 0, 1);
      await coreVoting.connect(signers[2]).vote(votingVaults, 0, 0);

      const tx = coreVoting
        .connect(signers[0])
        .execute(0, targets, badcalldata);
      await expect(tx).to.be.revertedWith("hash mismatch");
    });
    it("correctly executes a proposal - voted yes", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, targets, calldatas, 0);

      // pass proposal with 2/3 majority
      await coreVoting.connect(signers[1]).vote(votingVaults, 0, 1);
      await coreVoting.connect(signers[2]).vote(votingVaults, 0, 0);

      await coreVoting.connect(signers[0]).execute(0, targets, calldatas);

      const timelockTargets = await timelock.getTargets(0);
      const timelockCalldatas = await timelock.getCalldatas(0);

      expect(timelockTargets.length).to.be.eq(targets.length);
      expect(timelockCalldatas.length).to.be.eq(calldatas.length);
      expect(timelockCalldatas[1]).to.be.eq(calldatas[1]);

      const proposal = await coreVoting.getProposalData(0);
      expect(proposal[1]).to.be.eq(0);
    });
    it("correctly executes a proposal - voted no", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678FFFFFFFF", "0x12345678FFFFFFFF"];

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, targets, calldatas, 0);

      // pass proposal with 2/3 majority
      await coreVoting.connect(signers[1]).vote(votingVaults, 0, 1);
      await coreVoting.connect(signers[2]).vote(votingVaults, 0, 1);

      await coreVoting.connect(signers[0]).execute(0, targets, calldatas);

      const timelockTargets = await timelock.getTargets(0);
      const timelockCalldatas = await timelock.getCalldatas(0);

      // timelock should not have data on this proposal
      expect(timelockTargets.length).to.be.eq(0);
      expect(timelockCalldatas.length).to.be.eq(0);

      const proposal = await coreVoting.getProposalData(0);
      expect(proposal[1]).to.be.eq(0);
    });
  });
});
