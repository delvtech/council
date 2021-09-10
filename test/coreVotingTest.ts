import "module-alias/register";

import { expect } from "chai";
import { ethers, waffle, network } from "hardhat";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

import { TestCoreVoting } from "../typechain/TestCoreVoting";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import corevotingData from "../artifacts/contracts/mocks/TestCoreVoting.sol/TestCoreVoting.json";
import { advanceBlocks } from "./helpers/time";
import { BigNumber } from "@ethersproject/contracts/node_modules/@ethersproject/bignumber";
import { Reverter } from "../typechain/Reverter";

const { provider } = waffle;

describe("CoreVoting", function () {
  let coreVoting: TestCoreVoting;
  const votingVaults: Array<string> = new Array<string>();
  const baseVotingPower = 1e10;
  const MAX = ethers.constants.MaxUint256;

  let signers: SignerWithAddress[];

  const zeroExtraData = ["0x", "0x", "0x", "0x"];

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
    coreVoting = await coreVotingDeployer.deploy(
      signers[0].address,
      0,
      0,
      ethers.constants.AddressZero,
      votingVaults
    );
    // Override default lock duration
    await coreVoting.connect(signers[0]).setLockDuration(0);
    await coreVoting.connect(signers[0]).changeExtraVotingTime(500);
  });
  after(async () => {
    await restoreSnapshot(provider);
  });
  // Each describe block is independent
  beforeEach(async () => {
    await createSnapshot(provider);
  });
  afterEach(async () => {
    await restoreSnapshot(provider);
  });

  describe("proposal", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to create a new proposal with array length mismatch", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff"];

      const tx = coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, calldatas, MAX, 0);

      await expect(tx).to.be.revertedWith("array length mismatch");
    });
    it("fails to create a new proposal with insufficient voting power", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];

      await coreVoting
        .connect(signers[0])
        .setMinProposalPower(baseVotingPower * 4);
      await coreVoting
        .connect(signers[0])
        .setDefaultQuorum(baseVotingPower * 4);

      const tx = coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, calldatas, MAX, 0);

      await expect(tx).to.be.revertedWith("insufficient voting power");
    });
    it("fails to propose with lastCall too low", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];

      const blocknumber = await network.provider.send("eth_blockNumber", []);
      const tx = coreVoting
        .connect(signers[0])
        .proposal(
          votingVaults,
          zeroExtraData,
          targets,
          calldatas,
          BigNumber.from(blocknumber).add(499),
          0
        );
      await expect(tx).to.be.revertedWith("expires before voting ends");
    });
    it("creates a new proposal", async () => {
      const block = await getBlock();

      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, calldatas, MAX, 0);

      const proposal = await coreVoting.getProposalData(0);

      expect(proposal[1]).to.be.eq(block);
      expect(proposal[2]).to.be.eq(block + 1);
      expect(proposal[3]).to.be.eq(0);
      expect(proposal[4][0]).to.be.eq(baseVotingPower * 3);
      expect(proposal[4][1]).to.be.eq(0);
      expect(proposal[4][2]).to.be.eq(0);
    });
    it("correctly calculates quorum [1,2,b=5] = 5", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = [
        "0xAAAAAAAAffffffff",
        "0xBBBBBBBBffffffff",
        "0xCCCCCCCCffffffff",
      ];
      const baseQuorum = 5;

      // set default quorum above the caller's means
      await coreVoting.connect(signers[0]).setDefaultQuorum(baseQuorum);

      //set the individual selector quorums within the user's means
      await coreVoting
        .connect(signers[0])
        .setCustomQuorum(targets[0], "0xAAAAAAAA", 1);
      await coreVoting
        .connect(signers[0])
        .setCustomQuorum(targets[1], "0xBBBBBBBB", 2);

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, calldatas, MAX, 0);

      const proposal = await coreVoting.getProposalData(0);
      expect(proposal[3]).to.be.eq(baseQuorum);
    });
    it("correctly calculates quorum [10,10,b=5] = 10", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = [
        "0xAAAAAAAAffffffff",
        "0xBBBBBBBBffffffff",
        "0xCCCCCCCCffffffff",
      ];
      const baseQuorum = 5;

      // set default quorum above the caller's means
      await coreVoting.connect(signers[0]).setDefaultQuorum(baseQuorum);

      //set the individual selector quorums within the user's means
      await coreVoting
        .connect(signers[0])
        .setCustomQuorum(targets[0], "0xAAAAAAAA", 10);
      await coreVoting
        .connect(signers[0])
        .setCustomQuorum(targets[1], "0xBBBBBBBB", 10);

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, calldatas, MAX, 0);

      const proposal = await coreVoting.getProposalData(0);
      expect(proposal[3]).to.be.eq(10);
    });
    it("creates a new proposal with baseQuarum > votingPower < proposalQuorum", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0xAAAAAAAAffffffff", "0xBBBBBBBBffffffff"];

      // set default quorum above the caller's means
      await coreVoting
        .connect(signers[0])
        .setDefaultQuorum(baseVotingPower * 4);

      //set the individual selector quorums within the user's means
      await coreVoting
        .connect(signers[0])
        .setCustomQuorum(targets[0], "0xAAAAAAAA", baseVotingPower);
      await coreVoting
        .connect(signers[0])
        .setCustomQuorum(targets[1], "0xBBBBBBBB", baseVotingPower);

      const block = await getBlock();
      // the proposal should pass because the voting power requirement is the lesser of
      // the baseQuarum and the proposalQuorum.
      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, calldatas, MAX, 0);

      const proposal = await coreVoting.getProposalData(0);

      expect(proposal[1]).to.be.eq(block);
      expect(proposal[2]).to.be.eq(block + 1);
      expect(proposal[3]).to.be.eq(baseVotingPower);
      expect(proposal[4][0]).to.be.eq(baseVotingPower * 3);
      expect(proposal[4][1]).to.be.eq(0);
      expect(proposal[4][2]).to.be.eq(0);
    });
  });
  describe("vote", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    // We need to have a real proposal
    before(async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, calldatas, MAX, 0);
    });
    it("fails to vote with unapproved voting vault", async () => {
      votingVaults.push(ethers.constants.AddressZero);
      const tx = coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 0, 0);
      await expect(tx).to.be.revertedWith("unverified vault");
      votingVaults.pop();
    });
    it("fails to vote with duplicate voting vault", async () => {
      votingVaults.push(votingVaults[0]);
      const tx = coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 0, 0);
      await expect(tx).to.be.revertedWith("duplicate vault");
      votingVaults.pop();
    });
    it("fails to vote after extra voting time passes", async () => {
      votingVaults.push(votingVaults[0]);
      await increaseBlocknumber(provider, 500);
      const tx = coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 0, 0);
      await expect(tx).to.be.revertedWith("Expired");
      votingVaults.pop();
    });
    it("votes on a new proposal", async () => {
      const block = await getBlock();

      // proposal was with a yes vote. Match no votes.
      await coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 0, 1);

      const proposal = await coreVoting.getProposalData(0);

      expect(proposal[1]).to.be.eq(block - 1);
      expect(proposal[2]).to.be.eq(block);
      expect(proposal[3]).to.be.eq(0);
      expect(proposal[4][0]).to.be.eq(baseVotingPower * 3);
      expect(proposal[4][1]).to.be.eq(baseVotingPower * 3);
      expect(proposal[4][2]).to.be.eq(0);
    });
    it("correctly re-votes", async () => {
      const block = await getBlock();

      // proposal was with a yes vote. Match no votes.
      await coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 0, 1);
      // proposal was 50/50. make it full yes vote
      await coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 0, 0);

      const proposal = await coreVoting.getProposalData(0);

      expect(proposal[1]).to.be.eq(block - 1);
      expect(proposal[2]).to.be.eq(block);
      expect(proposal[3]).to.be.eq(0);
      expect(proposal[4][0]).to.be.eq(baseVotingPower * 6);
      expect(proposal[4][1]).to.be.eq(0);
      expect(proposal[4][2]).to.be.eq(0);
    });
    it("re-votes with lower power", async () => {
      const block = await getBlock();

      // proposal was with a yes vote. Match no votes.
      await coreVoting
        .connect(signers[0])
        .vote([votingVaults[0]], zeroExtraData, 0, 0);

      const proposal = await coreVoting.getProposalData(0);

      expect(proposal[1]).to.be.eq(block - 1);
      expect(proposal[2]).to.be.eq(block);
      expect(proposal[3]).to.be.eq(0);
      expect(proposal[4][0]).to.be.eq(baseVotingPower);
      expect(proposal[4][1]).to.be.eq(0);
      expect(proposal[4][2]).to.be.eq(0);
    });
  });
  // All proposal indexes in execute are incremented because the
  // snapshot doesn't appear to be working and an extra proposal is present here
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
        .proposal(votingVaults, zeroExtraData, targets, calldatas, MAX, 0);

      // pass proposal with 2/3 majority
      await coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 0, 1);
      await coreVoting
        .connect(signers[2])
        .vote(votingVaults, zeroExtraData, 0, 0);

      const tx = coreVoting
        .connect(signers[0])
        .execute(1, targets, badcalldata);
      await expect(tx).to.be.revertedWith("hash mismatch");
    });
    it("fails to execute inactive proposal", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];

      const tx = coreVoting.connect(signers[0]).execute(2, targets, calldatas);
      await expect(tx).to.be.revertedWith("Previously executed");
    });
    it("fails to execute a proposal prematurely", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];
      const badcalldata = ["0xBAD45678ffffffff", "0x12345678ffffffff"];

      // set default quorum above the caller's means
      await coreVoting.connect(signers[0]).setLockDuration(100);
      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, calldatas, MAX, 0);

      // pass proposal with 2/3 majority
      await coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 0, 1);
      await coreVoting
        .connect(signers[2])
        .vote(votingVaults, zeroExtraData, 0, 0);

      const tx = coreVoting
        .connect(signers[0])
        .execute(1, targets, badcalldata);
      await expect(tx).to.be.revertedWith("not unlocked");
    });
    it("fails to execute a proposal after last call blocknumber", async () => {
      const targets = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const calldatas = ["0x12345678ffffffff", "0x12345678ffffffff"];

      const blocknumber = await network.provider.send("eth_blockNumber", []);

      await coreVoting
        .connect(signers[0])
        .proposal(
          votingVaults,
          zeroExtraData,
          targets,
          calldatas,
          BigNumber.from(blocknumber).add(600),
          0
        );

      await advanceBlocks(provider, 600);

      const tx = coreVoting.connect(signers[0]).execute(1, targets, calldatas);
      await expect(tx).to.be.revertedWith("past last call timestamp");
    });
    it("executes a proposal - voted yes", async () => {
      const newDummyValue = 123423123;
      const targets = [coreVoting.address];
      const cvInterface = new ethers.utils.Interface(corevotingData.abi);
      const calldata = cvInterface.encodeFunctionData("updateDummy", [
        newDummyValue,
      ]);

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, [calldata], MAX, 0);

      // pass proposal with 2/3 majority
      await coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 1, 1);
      await coreVoting
        .connect(signers[2])
        .vote(votingVaults, zeroExtraData, 1, 0);

      await coreVoting.connect(signers[0]).execute(1, targets, [calldata]);

      const dummyValue = await coreVoting.dummyValue();
      const proposal = await coreVoting.getProposalData(1);

      expect(dummyValue).to.be.eq(newDummyValue);
      expect(proposal[1]).to.be.eq(0);
    });
    it("doesn't execute a proposal - voted no", async () => {
      const newDummyValue = 123423123;
      const targets = [coreVoting.address];
      const cvInterface = new ethers.utils.Interface(corevotingData.abi);
      const calldata = cvInterface.encodeFunctionData("updateDummy", [
        newDummyValue,
      ]);

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, [calldata], MAX, 0);

      // pass proposal with 2/3 majority
      await coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 1, 1);
      await coreVoting
        .connect(signers[2])
        .vote(votingVaults, zeroExtraData, 1, 1);

      const tx = coreVoting.connect(signers[0]).execute(1, targets, [calldata]);
      await expect(tx).to.be.revertedWith("Cannot execute");
    });
    it("doesn't execute a proposal - under quorum", async () => {
      const newDummyValue = 123423123;
      const targets = [coreVoting.address];
      const cvInterface = new ethers.utils.Interface(corevotingData.abi);
      const calldata = cvInterface.encodeFunctionData("updateDummy", [
        newDummyValue,
      ]);

      await coreVoting
        .connect(signers[0])
        .setDefaultQuorum(baseVotingPower * 4);

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, [calldata], MAX, 0);

      // pass proposal with 2/3 majority
      await coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 1, 1);
      await coreVoting
        .connect(signers[2])
        .vote(votingVaults, zeroExtraData, 1, 1);

      const tx = coreVoting.connect(signers[0]).execute(1, targets, [calldata]);
      await expect(tx).to.be.revertedWith("Cannot execute");
    });
    it("reverts if a sub-call reverts", async () => {
      const reverterDeployer = await ethers.getContractFactory("Reverter");
      const reverter: Reverter = await reverterDeployer.deploy();

      const targets = [reverter.address];
      const data = [reverter.interface.encodeFunctionData("fail")];

      await coreVoting
        .connect(signers[0])
        .proposal(votingVaults, zeroExtraData, targets, data, MAX, 0);

      // pass proposal with 2/3 majority
      await coreVoting
        .connect(signers[1])
        .vote(votingVaults, zeroExtraData, 1, 1);
      await coreVoting
        .connect(signers[2])
        .vote(votingVaults, zeroExtraData, 1, 0);

      const tx = coreVoting.connect(signers[0]).execute(1, targets, data);
      await expect(tx).to.be.revertedWith("Call failed");
    });
  });

  describe("setMinProposalPower", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to execute if caller is not the timelock", async () => {
      const tx = coreVoting.connect(signers[1]).setMinProposalPower(100);

      await expect(tx).to.be.revertedWith("Sender not owner");
    });
    it("correctly executes", async () => {
      await coreVoting.connect(signers[0]).setMinProposalPower(100);

      const minProposalPower = await coreVoting.minProposalPower();
      expect(minProposalPower).to.be.eq(100);
    });
  });

  describe("setDefaultQuorum", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to execute if caller is not the timelock", async () => {
      const tx = coreVoting.connect(signers[1]).setDefaultQuorum(100);

      await expect(tx).to.be.revertedWith("Sender not owner");
    });
    it("correctly executes", async () => {
      await coreVoting.connect(signers[0]).setDefaultQuorum(100);

      const baseQuarum = await coreVoting.baseQuorum();
      expect(baseQuarum).to.be.eq(100);
    });
  });
  describe("setLockDuration", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to execute if caller is not the timelock", async () => {
      const tx = coreVoting.connect(signers[1]).setLockDuration(100);

      await expect(tx).to.be.revertedWith("Sender not owner");
    });
    it("correctly executes", async () => {
      await coreVoting.connect(signers[0]).setLockDuration(100);

      const lockDuration = await coreVoting.lockDuration();
      expect(lockDuration).to.be.eq(100);
    });
  });

  describe("setCustomQuorum", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to execute if caller is not the timelock", async () => {
      const tx = coreVoting
        .connect(signers[1])
        .setCustomQuorum(signers[0].address, "0x11223344", 244);

      await expect(tx).to.be.revertedWith("Sender not owner");
    });
    it("correctly executes", async () => {
      await coreVoting
        .connect(signers[0])
        .setCustomQuorum(signers[0].address, "0x11223344", 244);

      const quorum = await coreVoting.getCustomQuorum(
        signers[0].address,
        "0x11223344"
      );
      expect(quorum).to.be.eq(244);
    });
  });
  describe("changeVaultStatus", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to execute if caller is not the timelock", async () => {
      const tx = coreVoting
        .connect(signers[1])
        .changeVaultStatus(signers[0].address, true);

      await expect(tx).to.be.revertedWith("Sender not owner");
    });
    it("correctly executes", async () => {
      await coreVoting
        .connect(signers[0])
        .changeVaultStatus(signers[0].address, true);

      const status = await coreVoting.getVaultStatus(signers[0].address);
      expect(status).to.be.eq(true);
    });
  });
  describe("changeExtraVoteTime", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to execute if caller is not the timelock", async () => {
      const tx = coreVoting.connect(signers[1]).changeExtraVotingTime(100);

      await expect(tx).to.be.revertedWith("Sender not owner");
    });
    it("correctly executes", async () => {
      await coreVoting.connect(signers[0]).changeExtraVotingTime(100);

      const status = await coreVoting.extraVoteTime();
      expect(status).to.be.eq(100);
    });
  });
});
// TODO: make library
async function increaseBlocknumber(provider: any, times: number) {
  for (let i = 0; i < times; i++) {
    await provider.send("evm_mine", []);
  }
}
