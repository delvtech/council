import "module-alias/register";

import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumberish, BigNumber } from "ethers";
import { GSCVault } from "typechain/GSCVault";
import { MockERC20 } from "typechain/MockERC20";
import { MockVotingVault } from "typechain/MockVotingVault";
import { MockCoreVoting } from "typechain/MockCoreVoting";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import exp from "constants";

const { provider } = waffle;

describe("GSC Vault", function () {
  // We use the history tracker and signers in each test
  let gscVault: GSCVault;
  let votingVault: MockVotingVault;
  let coreVoting: MockCoreVoting;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  const one = ethers.utils.parseEther("1");

  before(async function () {
    // Create a before snapshot
    await createSnapshot(provider);
    signers = await ethers.getSigners();
    // Deploy the mock voting vault

    // deploy the mock voting vault
    const mockVaultDeployer = await ethers.getContractFactory(
      "MockVotingVault",
      signers[0]
    );
    votingVault = await mockVaultDeployer.deploy();

    // Deploy the mock core voting
    const coreVotingDeployer = await ethers.getContractFactory(
      "MockCoreVoting",
      signers[0]
    );
    coreVoting = await coreVotingDeployer.deploy();
    // approve the mock voting vault
    await coreVoting.setVault(votingVault.address, true);

    // Deploy the GSC Vault
    const deployer = await ethers.getContractFactory("GSCVault", signers[0]);
    gscVault = await deployer.deploy(
      coreVoting.address,
      one,
      signers[0].address
    );
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

  describe("Ownable Functions", async () => {
    it("Allows vote bound reset", async () => {
      await gscVault.setVotePowerBound(one.mul(2));
      const votePowerBound = await gscVault.votingPowerBound();
      expect(votePowerBound).to.be.eq(one.mul(2));
    });
    it("Blocks vote bound reset", async () => {
      const tx = gscVault.connect(signers[1]).setVotePowerBound(one.mul(2));
      await expect(tx).to.be.revertedWith("Sender not owner");
    });

    it("Allows core voting reset", async () => {
      await gscVault.setCoreVoting(signers[1].address);
      const coreVoting = await gscVault.coreVoting();
      expect(coreVoting).to.be.eq(signers[1].address);
    });
    it("Blocks core voting reset", async () => {
      const tx = gscVault.connect(signers[1]).setCoreVoting(signers[1].address);
      await expect(tx).to.be.revertedWith("Sender not owner");
    });

    it("Allows challenge time reset", async () => {
      await gscVault.setChallengeDuration(100);
      const duration = await gscVault.challengeDuration();
      expect(duration).to.be.eq(100);
    });
    it("Blocks challenge time reset", async () => {
      const tx = gscVault.connect(signers[1]).setChallengeDuration(100);
      await expect(tx).to.be.revertedWith("Sender not owner");
    });
  });

  it("Allows joins with enough votes", async () => {
    // We set the caller vote power to be one more than limit then call prove membership
    await votingVault.setVotingPower(signers[1].address, one.add(1));
    await gscVault.connect(signers[1]).proveMembership([votingVault.address]);
    // Check that we have vote power [second arg doesn't matter]
    const votes = await gscVault.queryVotingPower(signers[1].address, 20);
    expect(votes).to.be.eq(1);
  });

  it("Gives the owner 10k votes", async () => {
    const votes = await gscVault.queryVotingPower(signers[0].address, 20);
    expect(votes).to.be.eq(100000);
  });

  it("Fails to add from unsupported vault", async () => {
    // we pick core voting because it's just some other contract address
    const tx = gscVault.proveMembership([coreVoting.address]);
    await expect(tx).to.be.revertedWith("Voting vault not approved");
  });

  it("Fails to add someone without enough votes", async () => {
    // We set the caller vote power to be one less than limit then call prove membership
    await votingVault.setVotingPower(signers[1].address, one.sub(1));
    // we pick core voting because it's just some other contract address
    const tx = gscVault.proveMembership([votingVault.address]);
    await expect(tx).to.be.revertedWith("Not enough votes");
  });

  // We group these to be able to replicate the setup between tests
  describe("Kicking Process", async () => {
    // Put two members on the council one with enough votes and one
    // with fewer votes.
    before(async () => {
      await votingVault.setVotingPower(signers[1].address, one.add(1));
      await votingVault.setVotingPower(signers[2].address, one.add(1));
      // Add the two members
      await gscVault.connect(signers[1]).proveMembership([votingVault.address]);
      await gscVault.connect(signers[2]).proveMembership([votingVault.address]);
      // Reduce voting power for signer 1
      await votingVault.setVotingPower(signers[1].address, one.sub(1));
      // We reduce the kick threshold to improve performance of sim which
      // repeatably calls for next block mining
      await gscVault.setChallengeDuration(100);
    });

    // Before each we snapshot
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    // After we reset our state in the fork
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it("Allows challenge for both", async () => {
      const tx1 = await (await gscVault.challenge(signers[1].address)).wait();
      const tx2 = await (await gscVault.challenge(signers[2].address)).wait();

      const status1 = await gscVault.members(signers[1].address);
      // Check the member status
      expect(status1[0]).to.be.eq(true);
      expect(status1[1]).to.be.eq(true);
      expect(status1[2]).to.be.eq(tx1.blockNumber);

      const status2 = await gscVault.members(signers[2].address);
      // Check the member status
      expect(status2[0]).to.be.eq(true);
      expect(status2[1]).to.be.eq(true);
      expect(status2[2]).to.be.eq(tx2.blockNumber);
    });

    it("Allows kicking after waiting", async () => {
      const tx1 = await (await gscVault.challenge(signers[1].address)).wait();
      const tx2 = await (await gscVault.challenge(signers[2].address)).wait();

      await gscVault.challenge(signers[1].address);
      await increaseBlocknumber(provider, 100);
      await gscVault.kick(signers[1].address);
      const status = await gscVault.members(signers[1].address);
      // Check the member status
      expect(status[0]).to.be.eq(false);
      expect(status[1]).to.be.eq(false);
      expect(status[2]).to.be.eq(0);
    });

    it("Allows member to reprove membership if valid", async () => {
      const tx1 = await (await gscVault.challenge(signers[1].address)).wait();
      const tx2 = await (await gscVault.challenge(signers[2].address)).wait();

      // mine a few blocks for good measure
      await increaseBlocknumber(provider, 10);

      await gscVault.connect(signers[2]).proveMembership([votingVault.address]);
      const tx = gscVault
        .connect(signers[1])
        .proveMembership([votingVault.address]);
      await expect(tx).to.be.revertedWith("Not enough votes");

      const status = await gscVault.members(signers[2].address);
      // Check the member status
      expect(status[0]).to.be.eq(true);
      expect(status[1]).to.be.eq(false);
      expect(status[2]).to.be.eq(0);
    });

    it("Blocks invalid kicks", async () => {
      // Kick attempt without challenge period
      let tx = gscVault.kick(signers[1].address);
      await expect(tx).to.be.revertedWith("Challenge failed or not started");
      tx = gscVault.kick(signers[2].address);
      await expect(tx).to.be.revertedWith("Challenge failed or not started");
      // Now challenge and attempt to kick before period
      await gscVault.challenge(signers[1].address);
      await gscVault.challenge(signers[2].address);
      // Mine a few blocks
      await increaseBlocknumber(provider, 50);
      // Kicks should still fail
      tx = gscVault.kick(signers[1].address);
      await expect(tx).to.be.revertedWith("Not enough time passed");
      tx = gscVault.kick(signers[2].address);
      await expect(tx).to.be.revertedWith("Not enough time passed");
    });
  });
});

async function increaseBlocknumber(provider: any, times: number) {
  for (let i = 0; i < times; i++) {
    await provider.send("evm_mine", []);
  }
}
