import "module-alias/register";

import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumberish, BigNumber } from "ethers";
import { OptimisticGrants } from "../typechain/OptimisticGrants";
import { MockERC20 } from "../typechain/MockERC20";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { advanceTime } from "./helpers/time";

const { provider } = waffle;

describe("Optimistic Grants", function () {
  // We use the history tracker and signers in each test
  let grants: OptimisticGrants;
  let token: MockERC20;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  const amount: BigNumber = ethers.utils.parseEther("10");

  async function timestamp() {
    return (await ethers.provider.getBlock("latest")).timestamp;
  }
  before(async function () {
    // Create a before snapshot
    await createSnapshot(provider);

    signers = await ethers.getSigners();

    // deploy the token;
    const erc20Deployer = await ethers.getContractFactory(
      "MockERC20",
      signers[0]
    );
    token = await erc20Deployer.deploy("Ele", "test ele", signers[0].address);

    // deploy the contract
    const deployer = await ethers.getContractFactory(
      "OptimisticGrants",
      signers[0]
    );

    grants = await deployer.deploy(token.address, signers[0].address);

    await token.setBalance(signers[0].address, amount);
    await token.connect(signers[0]).approve(grants.address, amount);
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
  describe("deposit", async () => {
    // Before each we snapshot
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    // After we reset our state in the fork
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("correctly deposits value to the optimistic grant solvency", async () => {
      await grants.deposit(amount);
      const balance = await token.balanceOf(grants.address);
      expect(balance).to.be.eq(amount);
    });
  });
  describe("withdraw", async () => {
    // Before each we snapshot
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    // After we reset our state in the fork
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not governance", async () => {
      await grants.deposit(amount);
      const tx = grants
        .connect(signers[1])
        .withdraw(amount, signers[1].address);
      await expect(tx).to.be.revertedWith("!governance");
    });
    it("fails to withdraw over solvency", async () => {
      await grants.deposit(amount);
      const tx = grants
        .connect(signers[0])
        .withdraw(amount.add(1), signers[1].address);
      await expect(tx).to.be.revertedWith("insufficient funds");
    });
    it("correctly withdraws", async () => {
      await grants.deposit(amount);
      await grants.connect(signers[0]).withdraw(amount, signers[1].address);
      const balance = await token.balanceOf(signers[1].address);
      expect(balance).to.be.eq(amount);
    });
  });
  describe("configureGrant", async () => {
    // Before each we snapshot
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    // After we reset our state in the fork
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to add a grant if caller is not governance", async () => {
      const now = await timestamp();
      await grants.deposit(amount);

      const tx = grants
        .connect(signers[1])
        .configureGrant(signers[1].address, amount, now + 10000);
      await expect(tx).to.be.revertedWith("!governance");
    });
    it("fails to add a grant with insufficient solvency", async () => {
      const now = await timestamp();
      const tx = grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount, now + 10000);
      await expect(tx).to.be.reverted;
    });
    it("correctly adds a grant", async () => {
      const now = await timestamp();
      await grants.deposit(amount);

      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount, now + 10000);
      const map = await grants.grants(signers[1].address);
      expect(map[0]).to.be.eq(amount);
      expect(map[1]).to.be.eq(now + 10000);
    });
    it("correctly removes a grant", async () => {
      const now = await timestamp();
      await grants.deposit(amount);

      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount, now + 10000);

      let map = await grants.grants(signers[1].address);
      expect(map[0]).to.be.eq(amount);
      expect(map[1]).to.be.eq(now + 10000);

      await grants.connect(signers[0]).configureGrant(signers[1].address, 0, 0);

      map = await grants.grants(signers[1].address);
      const solvency = await grants.solvency();

      expect(solvency).to.be.eq(amount);
      expect(map[0]).to.be.eq(0);
      expect(map[1]).to.be.eq(0);
    });
    it("correctly updates a grant - expiration change", async () => {
      const now = await timestamp();
      await grants.deposit(amount);

      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount, now + 10000);
      let map = await grants.grants(signers[1].address);
      expect(map[0]).to.be.eq(amount);
      expect(map[1]).to.be.eq(now + 10000);

      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount, now + 100);
      map = await grants.grants(signers[1].address);
      expect(map[0]).to.be.eq(amount);
      expect(map[1]).to.be.eq(now + 100);
    });
    it("correctly updates a grant - amount increase", async () => {
      const now = await timestamp();
      await grants.deposit(amount);

      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount.div(2), now + 10000);

      let map = await grants.grants(signers[1].address);
      let solvency = await grants.solvency();

      expect(solvency).to.be.eq(amount.div(2));
      expect(map[0]).to.be.eq(amount.div(2));
      expect(map[1]).to.be.eq(now + 10000);

      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount, now + 10000);

      map = await grants.grants(signers[1].address);
      solvency = await grants.solvency();

      // make sure that the grant info and solvency was correctly updated
      expect(solvency).to.be.eq(0);
      expect(map[0]).to.be.eq(amount);
      expect(map[1]).to.be.eq(now + 10000);
    });
    it("correctly updates a grant - amount decrease", async () => {
      const now = await timestamp();
      await grants.deposit(amount);

      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount, now + 10000);

      let map = await grants.grants(signers[1].address);
      let solvency = await grants.solvency();

      expect(solvency).to.be.eq(0);
      expect(map[0]).to.be.eq(amount);
      expect(map[1]).to.be.eq(now + 10000);

      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount.div(2), now + 10000);

      map = await grants.grants(signers[1].address);
      solvency = await grants.solvency();

      // make sure that the grant info and solvency was correctly updated
      expect(solvency).to.be.eq(amount.div(2));
      expect(map[0]).to.be.eq(amount.div(2));
      expect(map[1]).to.be.eq(now + 10000);
    });
  });
  describe("claim", async () => {
    // Before each we snapshot
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    // After we reset our state in the fork
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to claim immature grant", async () => {
      const now = await timestamp();
      await grants.deposit(amount);
      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount, now + 10000);

      const tx = grants.connect(signers[1]).claim(signers[1].address);
      await expect(tx).to.be.revertedWith("not mature");
    });
    it("correctly claims mature grant", async () => {
      const now = await timestamp();
      await grants.deposit(amount);
      await grants
        .connect(signers[0])
        .configureGrant(signers[1].address, amount, now + 10000);

      advanceTime(provider, 10000);
      await grants.connect(signers[1]).claim(signers[2].address);

      const balance = await token.balanceOf(signers[2].address);
      await expect(balance).to.eq(amount);

      // make sure that the grant was deleted
      const map = await grants.grants(signers[1].address);
      expect(map[0]).to.be.eq(0);
      expect(map[1]).to.be.eq(0);
    });
  });
});
