import "module-alias/register";

import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumberish, BigNumber } from "ethers";
import { Airdrop } from "../typechain/Airdrop";
import { MockERC20 } from "../typechain/MockERC20";
import { MockLockingVault } from "../typechain/MockLockingVault";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { MerkleTree } from "merkletreejs";
import { Account, getMerkleTree, hashAccount } from "./helpers/merkle";

const { provider } = waffle;

// Note tests both the Airdrop and Merkle rewards from one set of tests

describe("Airdrop + Merkle Rewards Feature", function () {
  // We use the history tracker and signers in each test
  let drop: Airdrop;
  let lockingVault: MockLockingVault;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  let token: MockERC20;
  let merkle: MerkleTree;
  let accounts: Account[];
  const one = ethers.utils.parseEther("1");
  let expiration: number;

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
      "Airdrop",
      signers[0]
    );
    expiration = Math.floor(new Date().getTime() / 1000) + 2629746;
    drop = await airdropDeployer.deploy(
      signers[0].address,
      merkle.getHexRoot(),
      token.address,
      // Current unix stamp + 1 month in seconds
      expiration,
      lockingVault.address
    );

    await token.setBalance(drop.address, one.mul(3));
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

  it("Allows claiming the airdrop", async () => {
    for (let i = 0; i < 3; i++) {
      const proof = merkle.getHexProof(await hashAccount(accounts[i]));
      await drop.connect(signers[i]).claim(one, one, proof, signers[i].address);

      const balance = await token.balanceOf(signers[i].address);
      expect(balance).to.be.eq(one);
    }
  });

  it("Allows claiming and delegating the airdrop", async () => {
    for (let i = 0; i < 3; i++) {
      const proof = merkle.getHexProof(await hashAccount(accounts[i]));
      await drop
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

  it("Blocks claiming over the airdrop", async () => {
    const proof = merkle.getHexProof(await hashAccount(accounts[0]));
    await drop.claim(one, one, proof, signers[0].address);
    let tx = drop.claim(1, one, proof, signers[0].address);
    await expect(tx).to.be.revertedWith("Claimed too much");
    tx = drop.claimAndDelegate(
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
    const tx = drop.claim(one, one.mul(2), proof, signers[0].address);
    await expect(tx).to.be.revertedWith("Invalid Proof");
  });

  it("Blocks gov withdraw before expiration", async () => {
    const tx = drop.reclaim(signers[3].address);
    await expect(tx).to.be.revertedWith("");
  });

  it("Allows gov to withdraw after expiration", async () => {
    await provider.send("evm_increaseTime", [expiration + 1]);
    await provider.send("evm_mine", []);
    await drop.reclaim(signers[3].address);
    const reclaimed = await token.balanceOf(signers[3].address);
    expect(reclaimed).to.be.eq(one.mul(3));
  });

  it("Blocks non-gov to withdraw", async () => {
    let tx = drop.connect(signers[1]).reclaim(signers[3].address);
    await expect(tx).to.be.reverted;
    await provider.send("evm_increaseTime", [expiration + 1]);
    await provider.send("evm_mine", []);
    tx = drop.connect(signers[1]).reclaim(signers[3].address);
    await expect(tx).to.be.revertedWith("");
  });
});
