import "module-alias/register";

import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { BigNumber } from "ethers";

import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { advanceBlocks } from "./helpers/time";

import { TestVestingVault } from "../typechain/TestVestingVault";
import { MockERC20 } from "../typechain/MockERC20";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const { provider } = waffle;

describe("VestingVault", function () {
  let vestingVault: TestVestingVault;
  let signers: SignerWithAddress[];
  let token: MockERC20;
  const amount: BigNumber = ethers.utils.parseEther("10");

  async function getBlock() {
    return (await ethers.provider.getBlock("latest")).number;
  }

  before(async function () {
    await createSnapshot(provider);
    signers = await ethers.getSigners();
    const vestingVaultDeployer = await ethers.getContractFactory(
      "TestVestingVault",
      signers[0]
    );

    const erc20Deployer = await ethers.getContractFactory(
      "MockERC20",
      signers[0]
    );

    token = await erc20Deployer.deploy("Ele", "test ele");
    vestingVault = await vestingVaultDeployer.deploy(
      token.address,
      199350,
      signers[0].address,
      signers[0].address
    );

    await token.setBalance(signers[0].address, amount);
    await token.connect(signers[0]).approve(vestingVault.address, amount);
    await vestingVault.connect(signers[0]).deposit(amount);
  });
  after(async () => {
    await restoreSnapshot(provider);
  });

  describe("deposit", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not the manager", async () => {
      await token.setBalance(signers[1].address, 100);
      await token.connect(signers[1]).approve(vestingVault.address, 100);
      const tx = vestingVault.connect(signers[1]).deposit(100);
      await expect(tx).to.be.revertedWith("!manager");
    });
    it("correctly deposits", async () => {
      await token.setBalance(signers[0].address, amount);
      await token.connect(signers[0]).approve(vestingVault.address, amount);
      await vestingVault.connect(signers[0]).deposit(amount);

      const unassigned = await vestingVault.unassigned();
      expect(unassigned).to.be.eq(amount.mul(2));
    });
  });
  describe("withdraw", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not the manager", async () => {
      const tx = vestingVault
        .connect(signers[1])
        .withdraw(amount, signers[0].address);
      await expect(tx).to.be.revertedWith("!manager");
    });
    it("correctly withdraws", async () => {
      await vestingVault
        .connect(signers[0])
        .withdraw(amount, signers[0].address);
      const unassigned = await vestingVault.unassigned();
      const balance = await token.balanceOf(signers[0].address);

      expect(unassigned).to.be.eq(0);
      expect(balance).to.be.eq(amount);
    });
  });
  describe("addGrantAndDelegate", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails to add grant if the contract can't cover it", async () => {
      const block = await getBlock();
      const tx = vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount.add(1),
          block + 100,
          block + 50,
          ethers.constants.AddressZero
        );
      await expect(tx).to.be.revertedWith("Insufficient balance");
    });
    it("fails to add grant if the received already has an active grant", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount.div(2),
          block + 100,
          block + 50,
          ethers.constants.AddressZero
        );
      const tx = vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount.div(2),
          block + 100,
          block + 50,
          ethers.constants.AddressZero
        );
      await expect(tx).to.be.revertedWith("Has Grant");
    });
    it("correctly adds grant without delegation", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 100,
          block + 50,
          ethers.constants.AddressZero
        );

      const grant = await vestingVault.getGrant(signers[1].address);

      expect(grant[0]).to.be.eq(amount);
      expect(grant[1]).to.be.eq(0);
      expect(grant[2]).to.be.eq(block + 1);
      expect(grant[3]).to.be.eq(block + 100);
      expect(grant[4]).to.be.eq(block + 50);
      expect(grant[5]).to.be.eq(amount);
      expect(grant[6]).to.be.eq(signers[1].address);

      const votingPower = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 1
      );
      expect(votingPower).to.be.eq(amount);
    });
    it("correctly adds grant with delegation", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 100,
          block + 50,
          signers[0].address
        );

      const grant = await vestingVault.getGrant(signers[1].address);

      expect(grant[0]).to.be.eq(amount);
      expect(grant[1]).to.be.eq(0);
      expect(grant[2]).to.be.eq(block + 1);
      expect(grant[3]).to.be.eq(block + 100);
      expect(grant[4]).to.be.eq(block + 50);
      expect(grant[5]).to.be.eq(amount);
      expect(grant[6]).to.be.eq(signers[0].address);

      const votingPower = await vestingVault.queryVotePowerView(
        signers[0].address,
        block + 1
      );
      expect(votingPower).to.be.eq(amount);
    });
  });
  describe("remove grant", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not the manager", async () => {
      const tx = vestingVault
        .connect(signers[1])
        .removeGrant(ethers.constants.AddressZero);
      await expect(tx).to.be.revertedWith("!manager");
    });
    it("correctly removes grant - no unlocked value", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount.div(2),
          block + 100,
          block + 50,
          ethers.constants.AddressZero
        );

      await vestingVault.connect(signers[0]).removeGrant(signers[1].address);

      const grant = await vestingVault.getGrant(signers[1].address);

      expect(grant[0]).to.be.eq(0);
      expect(grant[1]).to.be.eq(0);
      expect(grant[2]).to.be.eq(0);
      expect(grant[3]).to.be.eq(0);
      expect(grant[4]).to.be.eq(0);
      expect(grant[5]).to.be.eq(0);
      expect(grant[6]).to.be.eq(ethers.constants.AddressZero);

      const tokeBalance = await token.balanceOf(signers[1].address);
      expect(tokeBalance).to.be.eq(0);

      const unassigned = await vestingVault.unassigned();
      expect(unassigned).to.be.eq(amount);

      const votingPowerTo = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 3
      );
      expect(votingPowerTo).to.be.eq(0);
    });
    it("correctly removes grant - half unlocked value", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );

      await advanceBlocks(provider, 4);
      await vestingVault.connect(signers[0]).removeGrant(signers[1].address);

      const grant = await vestingVault.getGrant(signers[1].address);

      expect(grant[0]).to.be.eq(0);
      expect(grant[1]).to.be.eq(0);
      expect(grant[2]).to.be.eq(0);
      expect(grant[3]).to.be.eq(0);
      expect(grant[4]).to.be.eq(0);
      expect(grant[5]).to.be.eq(0);
      expect(grant[6]).to.be.eq(ethers.constants.AddressZero);

      const tokeBalance = await token.balanceOf(signers[1].address);
      expect(tokeBalance).to.be.eq(amount.div(2));

      const unassigned = await vestingVault.unassigned();
      expect(unassigned).to.be.eq(amount.div(2));

      const votingPowerTo = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 7
      );
      expect(votingPowerTo).to.be.eq(0);
    });
    it("correctly removes grant - full unlocked value", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );

      await advanceBlocks(provider, 12);
      await vestingVault.connect(signers[0]).removeGrant(signers[1].address);

      const grant = await vestingVault.getGrant(signers[1].address);

      expect(grant[0]).to.be.eq(0);
      expect(grant[1]).to.be.eq(0);
      expect(grant[2]).to.be.eq(0);
      expect(grant[3]).to.be.eq(0);
      expect(grant[4]).to.be.eq(0);
      expect(grant[5]).to.be.eq(0);
      expect(grant[6]).to.be.eq(ethers.constants.AddressZero);

      const tokeBalance = await token.balanceOf(signers[1].address);
      expect(tokeBalance).to.be.eq(amount);

      const unassigned = await vestingVault.unassigned();
      expect(unassigned).to.be.eq(0);

      const votingPowerTo = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 15
      );
      expect(votingPowerTo).to.be.eq(0);
    });
  });

  describe("claim", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fail to claim before cliff", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );
      await vestingVault.connect(signers[1]).claim();

      const grant = await vestingVault.getGrant(signers[1].address);
      // check that withdrawn is 0
      expect(grant[1]).to.be.eq(0);
    });
    it("correctly claims incrementally", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );
      await advanceBlocks(provider, 4);

      await vestingVault.connect(signers[1]).claim();
      let grant = await vestingVault.getGrant(signers[1].address);
      expect(grant[1]).to.be.eq(amount.mul(5).div(10));
      expect(grant[5]).to.be.eq(amount.mul(5).div(10));

      await vestingVault.connect(signers[1]).claim();
      grant = await vestingVault.getGrant(signers[1].address);
      expect(grant[1]).to.be.eq(amount.mul(6).div(10));
      expect(grant[5]).to.be.eq(amount.mul(4).div(10));

      await vestingVault.connect(signers[1]).claim();
      grant = await vestingVault.getGrant(signers[1].address);
      expect(grant[1]).to.be.eq(amount.mul(7).div(10));
      expect(grant[5]).to.be.eq(amount.mul(3).div(10));

      await vestingVault.connect(signers[1]).claim();
      grant = await vestingVault.getGrant(signers[1].address);
      expect(grant[1]).to.be.eq(amount.mul(8).div(10));
      expect(grant[5]).to.be.eq(amount.mul(2).div(10));

      await vestingVault.connect(signers[1]).claim();
      grant = await vestingVault.getGrant(signers[1].address);
      expect(grant[1]).to.be.eq(amount.mul(9).div(10));
      expect(grant[5]).to.be.eq(amount.mul(1).div(10));

      await vestingVault.connect(signers[1]).claim();
      grant = await vestingVault.getGrant(signers[1].address);
      expect(grant[1]).to.be.eq(amount);
      expect(grant[5]).to.be.eq(0);

      await vestingVault.connect(signers[1]).claim();
      grant = await vestingVault.getGrant(signers[1].address);
      expect(grant[1]).to.be.eq(amount);
      expect(grant[5]).to.be.eq(0);

      const unassigned = await vestingVault.unassigned();
      expect(unassigned).to.be.eq(0);
    });
  });
  describe("delegate", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("correctly delegates", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 100,
          block + 50,
          ethers.constants.AddressZero
        );

      await vestingVault.connect(signers[1]).delegate(signers[2].address);

      const votingPowerTo = await vestingVault.queryVotePowerView(
        signers[2].address,
        block + 4
      );
      const votingPowerFrom = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 4
      );
      expect(votingPowerTo).to.be.eq(amount);
      expect(votingPowerFrom).to.be.eq(0);
    });
  });
  describe("changeUnvestedMultiplier", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not the timelock", async () => {
      const tx = vestingVault.connect(signers[1]).changeUnvestedMultiplier(50);
      await expect(tx).to.be.revertedWith("!timelock");
    });
    it("correctly changes the unnvested multiplier", async () => {
      await vestingVault.connect(signers[0]).changeUnvestedMultiplier(50);
      const multiplier = await vestingVault.unvestedMultiplier();
      expect(multiplier).to.be.eq(50);
    });
  });
  describe("updateVotingPower", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("correctly handles unchanged voting power", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );

      let votingPower = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 4
      );
      expect(votingPower).to.be.eq(amount);

      await vestingVault.updateVotingPower(signers[1].address);

      votingPower = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 4
      );
      expect(votingPower).to.be.eq(amount);
    });

    it("correctly handles voting power increase", async () => {
      await vestingVault.connect(signers[0]).changeUnvestedMultiplier(50);

      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );

      let votingPower = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 4
      );
      expect(votingPower).to.be.eq(amount.div(2));

      await vestingVault.connect(signers[0]).changeUnvestedMultiplier(100);

      await vestingVault.updateVotingPower(signers[1].address);

      votingPower = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 4
      );
      expect(votingPower).to.be.eq(amount);
    });
    it("correctly handles voting power decrease", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );

      let votingPower = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 4
      );
      expect(votingPower).to.be.eq(amount);

      await vestingVault.connect(signers[0]).changeUnvestedMultiplier(50);

      await vestingVault.updateVotingPower(signers[1].address);

      votingPower = await vestingVault.queryVotePowerView(
        signers[1].address,
        block + 4
      );
      expect(votingPower).to.be.eq(amount.div(2));
    });
  });
});
