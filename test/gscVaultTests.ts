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
import exp, { EPERM } from "constants";

const { provider } = waffle;

describe("GSC Vault", function () {
  // We use the history tracker and signers in each test
  let gscVault: GSCVault;
  let votingVault: MockVotingVault;
  let coreVoting: MockCoreVoting;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  const one = ethers.utils.parseEther("1");

  const zeroExtraData = ["0x", "0x"];

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
    await gscVault
      .connect(signers[1])
      .proveMembership([votingVault.address], zeroExtraData);
    // Check that we have vote power [second arg doesn't matter]
    const votes = await gscVault.queryVotingPower(signers[1].address, 20, "0x");
    expect(votes).to.be.eq(1);
  });

  it("Gives the owner 10k votes", async () => {
    const votes = await gscVault.queryVotingPower(signers[0].address, 20, "0x");
    expect(votes).to.be.eq(100000);
  });

  it("Fails to add from unsupported vault", async () => {
    // we pick core voting because it's just some other contract address
    const tx = gscVault.proveMembership([coreVoting.address], zeroExtraData);
    await expect(tx).to.be.revertedWith("Voting vault not approved");
  });

  it("Fails to add someone without enough votes", async () => {
    // We set the caller vote power to be one less than limit then call prove membership
    await votingVault.setVotingPower(signers[1].address, one.sub(1));
    // we pick core voting because it's just some other contract address
    const tx = gscVault.proveMembership([votingVault.address], zeroExtraData);
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
      await gscVault
        .connect(signers[1])
        .proveMembership([votingVault.address], zeroExtraData);
      await gscVault
        .connect(signers[2])
        .proveMembership([votingVault.address], zeroExtraData);
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

    it("Allows kick for singer with not enough vote", async () => {
      // Kick and then check vaults
      await gscVault.kick(signers[1].address, zeroExtraData);
      // Check they have been fully removed
      const votes = await gscVault.queryVotingPower(
        signers[1].address,
        0,
        "0x"
      );
      expect(votes).to.be.eq(0);
    });

    it("Allows kick for singer with out of date vaults", async () => {
      // We set the vault to not be approved anymore
      await coreVoting.setVault(votingVault.address, false);
      // Use the otherwise qualified signer 2
      await gscVault.kick(signers[2].address, zeroExtraData);
      // Check they have been fully removed
      const votes = await gscVault.queryVotingPower(
        signers[2].address,
        0,
        "0x"
      );
      expect(votes).to.be.eq(0);
    });

    it("Blocks kicking for user with enough voting power", async () => {
      const tx1 = gscVault.kick(signers[2].address, zeroExtraData);
      await expect(tx1).to.be.revertedWith("Not kick-able");
    });

    it("Allows member to reprove membership if valid", async () => {
      // Challenge signer 1
      await gscVault.kick(signers[1].address, zeroExtraData);
      // check for removal
      let votes = await gscVault.queryVotingPower(signers[1].address, 0, "0x");
      expect(votes).to.be.eq(0);

      // Increase voting power for signer 1
      await votingVault.setVotingPower(signers[1].address, one.add(1));

      // mine a few blocks for good measure
      await increaseBlocknumber(provider, 10);
      // Reprove membership
      await gscVault
        .connect(signers[1])
        .proveMembership([votingVault.address], zeroExtraData);

      // Check the member status
      const storedVault = await gscVault.memberVaults(signers[1].address, 0);
      expect(storedVault).to.be.eq(votingVault.address);
      votes = await gscVault.queryVotingPower(signers[1].address, 0, "0x");
      expect(votes).to.be.eq(1);
    });
  });
});

async function increaseBlocknumber(provider: any, times: number) {
  for (let i = 0; i < times; i++) {
    await provider.send("evm_mine", []);
  }
}
