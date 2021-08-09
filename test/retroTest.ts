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

describe("Airdrop Feature", function () {
  // We use the history tracker and signers in each test
  let drop: Airdrop;
  let lockingVault: MockLockingVault;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  let token: MockERC20;
  let merkle: MerkleTree;
  let accounts: Account[];
  const one = ethers.utils.parseEther("1");

  before(async () => {
    // Create a before snapshot
    await createSnapshot(provider);
    signers = await ethers.getSigners();
    // deploy the token;
    const erc20Deployer = await ethers.getContractFactory(
      "MockERC20",
      signers[0]
    );
    token = await erc20Deployer.deploy("Ele", "test ele");

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
      {
        address: signers[2].address,
        value: one,
      },
    ];
    merkle = await getMerkleTree(accounts);
    console.log(merkle);

    const airdropDeployer = await ethers.getContractFactory(
      "Airdrop",
      signers[0]
    );
    console.log(merkle.getHexRoot());
    drop = await airdropDeployer.deploy(
      signers[0].address,
      merkle.getHexRoot(),
      token.address,
      // Current unix stamp + 1 month in seconds
      Math.floor(new Date().getTime() / 1000) + 2629746,
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
      await drop.connect(signers[i]).claim(one, one, proof);

      const balance = await token.balanceOf(signers[i].address);
      expect(balance).to.be.eq(one);
    }
  });
});
