import "module-alias/register";

import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { OptimisticRewards } from "../typechain/OptimisticRewards";
import { MockERC20 } from "../typechain/MockERC20";
import { MockLockingVault } from "../typechain/MockLockingVault";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { MerkleTree } from "merkletreejs";
import { Account, getMerkleTree, hashAccount } from "./helpers/merkle";
import { advanceTime } from "./helpers/time";

const { provider } = waffle;

// Note tests both the Airdrop and Merkle rewards from one set of tests

describe("Optimistic Rewards", function () {
  // We use the history tracker and signers in each test
  let rewards: OptimisticRewards;
  let lockingVault: MockLockingVault;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  let token: MockERC20;
  let merkle: MerkleTree;
  let accounts: Account[];
  const one = ethers.utils.parseEther("1");
  let expiration: number;
  const fakeRoot =
    "0x3ba7e2c00c9afcb890942e3be3b1b20a54274cc713a6191b95e7d9cea3938c32";

  before(async () => {
    // Create a before snapshot
    await createSnapshot(provider);
    signers = await ethers.getSigners();
    // deploy the token;
    const erc20Deployer = await ethers.getContractFactory(
      "MockERC20",
      signers[0]
    );
    token = await erc20Deployer.deploy("Ele", "test ele", signers[0].address);

    const mockLockDeployer = await ethers.getContractFactory(
      "MockLockingVault",
      signers[0]
    );
    lockingVault = await mockLockDeployer.deploy();

    accounts = [
      {
        address: signers[0].address,
        value: one,
      },
      {
        address: signers[1].address,
        value: one,
      },
      {
        address: signers[2].address,
        value: one,
      },
    ];
    merkle = await getMerkleTree(accounts);

    const airdropDeployer = await ethers.getContractFactory(
      "OptimisticRewards",
      signers[0]
    );

    rewards = await airdropDeployer.deploy(
      signers[0].address,
      merkle.getHexRoot(),
      signers[1].address,
      signers[2].address,
      token.address,
      lockingVault.address
    );

    await token.setBalance(rewards.address, one.mul(3));
  });

  // After we reset our state in the fork
  after(async () => {
    await restoreSnapshot(provider);
  });
  // Before each we snapshot
  beforeEach(async () => {
    // fund the spending address
    await createSnapshot(provider);
  });
  // After we reset our state in the fork
  afterEach(async () => {
    await restoreSnapshot(provider);
  });

  it("Allows claiming the rewards", async () => {
    for (let i = 0; i < 3; i++) {
      const proof = merkle.getHexProof(await hashAccount(accounts[i]));
      await rewards
        .connect(signers[i])
        .claim(one, one, proof, signers[i].address);

      const balance = await token.balanceOf(signers[i].address);
      expect(balance).to.be.eq(one);
    }
  });

  it("Allows claiming and delegating the rewards", async () => {
    for (let i = 0; i < 3; i++) {
      const proof = merkle.getHexProof(await hashAccount(accounts[i]));
      await rewards
        .connect(signers[i])
        .claimAndDelegate(
          one,
          signers[3].address,
          one,
          proof,
          signers[i].address
        );

      const balance = await lockingVault.deposits(signers[i].address);
      expect(balance).to.be.eq(one);
      const delegate = await lockingVault.delegation(signers[i].address);
      expect(delegate).to.be.eq(signers[3].address);
    }
  });

  it("Blocks claiming over the rewards threshold", async () => {
    const proof = merkle.getHexProof(await hashAccount(accounts[0]));
    await rewards.claim(one, one, proof, signers[0].address);
    let tx = rewards.claim(1, one, proof, signers[0].address);
    await expect(tx).to.be.revertedWith("Claimed too much");
    tx = rewards.claimAndDelegate(
      1,
      signers[1].address,
      one,
      proof,
      signers[0].address
    );
    await expect(tx).to.be.revertedWith("Claimed too much");
  });

  it("Blocks an invalid proof", async () => {
    const proof = merkle.getHexProof(await hashAccount(accounts[0]));
    const tx = rewards.claim(one, one.mul(2), proof, signers[0].address);
    await expect(tx).to.be.revertedWith("Invalid Proof");
  });

  it("Allows the proposer to propose new rewards", async () => {
    const tx = await (
      await rewards.connect(signers[1]).proposeRewards(fakeRoot)
    ).wait();
    const pendingRoot = await rewards.pendingRoot();
    expect(pendingRoot).to.be.eq(fakeRoot);
    const timestamp = await rewards.proposalTime();
    const block = await provider.send("eth_getBlockByHash", [
      tx.blockHash,
      true,
    ]);
    expect(timestamp).to.be.eq(block.timestamp);
    // This check is important because it checks that the updating logic is not triggered
    // early.
    const currentRoot = await rewards.rewardsRoot();
    expect(currentRoot).to.be.eq(merkle.getHexRoot());
  });

  it("blocks non proposer proposals", async () => {
    const tx = rewards.proposeRewards(fakeRoot);
    await expect(tx).to.be.revertedWith("Not proposer");
  });

  it("Allows revoker to revoke", async () => {
    await rewards.connect(signers[1]).proposeRewards(fakeRoot);
    await rewards.connect(signers[2]).challengeRewards();
    const pendingRoot = await rewards.pendingRoot();
    const timestamp = await rewards.proposalTime();

    expect(timestamp).to.be.eq(0);
    expect(pendingRoot).to.be.eq(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
  });

  it("blocks non revokers from revoking", async () => {
    const tx = rewards.challengeRewards();
    await expect(tx).to.be.revertedWith("Sender not Authorized");
  });

  it("rolls over root if proposal is called again after a period", async () => {
    await rewards.connect(signers[1]).proposeRewards(fakeRoot);
    await advanceTime(provider, 60 * 60 * 24 * 7);
    const tx = await (
      await rewards.connect(signers[1]).proposeRewards(merkle.getHexRoot())
    ).wait();

    const currentRoot = await rewards.rewardsRoot();
    const pendingRoot = await rewards.pendingRoot();
    const block = await provider.send("eth_getBlockByHash", [
      tx.blockHash,
      true,
    ]);
    const timestamp = await rewards.proposalTime();

    expect(currentRoot).to.be.eq(fakeRoot);
    expect(pendingRoot).to.be.eq(merkle.getHexRoot());
    expect(timestamp).to.be.eq(block.timestamp);
  });

  it("allows gov to reset permission-ed state var", async () => {
    await rewards.setProposer(signers[3].address);
    await rewards.setChallengePeriod(100);
    const proposer = await rewards.proposer();
    expect(proposer).to.be.eq(signers[3].address);
    const challengePeriod = await rewards.challengePeriod();
    expect(challengePeriod).to.be.eq(100);
  });

  it("blocks non gov reset of permission-ed state var", async () => {
    let tx = rewards.connect(signers[1]).setProposer(signers[1].address);
    await expect(tx).to.be.revertedWith("Sender not owner");
    tx = rewards.connect(signers[1]).setChallengePeriod(100);
    await expect(tx).to.be.revertedWith("Sender not owner");
  });
});
