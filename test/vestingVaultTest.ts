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

    token = await erc20Deployer.deploy("Ele", "test ele", signers[0].address);
    vestingVault = await vestingVaultDeployer.deploy(token.address, 199350);
    await vestingVault.initialize(signers[0].address, signers[0].address);

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
          0,
          block + 100,
          block + 50,
          ethers.constants.AddressZero
        );
      await expect(tx).to.be.revertedWith("Insufficient balance");
    });
    it("fails to add grant if cliff > expiry", async () => {
      const block = await getBlock();
      const tx = vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount.add(1),
          0,
          block + 100,
          block + 150,
          ethers.constants.AddressZero
        );
      await expect(tx).to.be.revertedWith("Invalid configuration");
    });
    it("fails to add grant if start > expiry", async () => {
      const block = await getBlock();
      const tx = vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount.add(1),
          block + 150,
          block + 100,
          block + 50,
          ethers.constants.AddressZero
        );
      await expect(tx).to.be.revertedWith("Invalid configuration");
    });
    it("fails to add grant if the received already has an active grant", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount.div(2),
          0,
          block + 100,
          block + 50,
          ethers.constants.AddressZero
        );
      const tx = vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount.div(2),
          0,
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
          0,
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
          block + 10,
          block + 100,
          block + 50,
          signers[0].address
        );

      const grant = await vestingVault.getGrant(signers[1].address);

      expect(grant[0]).to.be.eq(amount);
      expect(grant[1]).to.be.eq(0);
      expect(grant[2]).to.be.eq(block + 10);
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
          0,
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
          0,
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
          0,
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
          0,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );
      await vestingVault.connect(signers[1]).claim();

      const grant = await vestingVault.getGrant(signers[1].address);
      // check that withdrawn is 0
      expect(grant[1]).to.be.eq(0);
    });
    it("fail to claim before start", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 6,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );
      await vestingVault.connect(signers[1]).claim();

      const grant = await vestingVault.getGrant(signers[1].address);
      // check that withdrawn is 0
      expect(grant[1]).to.be.eq(0);
    });
    it("claims 0 at start", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          block + 2,
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
          0,
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
          0,
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
    it("Does not delegate to an address which is already delegated too", async () => {
      const block = await getBlock();

      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          0,
          block + 100,
          block + 50,
          signers[2].address
        );

      const tx = vestingVault.connect(signers[1]).delegate(signers[2].address);
      await expect(tx).to.be.revertedWith("Already delegated");
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
    it("fails if more than 100%", async () => {
      const tx = vestingVault.connect(signers[0]).changeUnvestedMultiplier(101);
      await expect(tx).to.be.revertedWith("Above 100%");
    });
  });
  describe("setTimelock", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not the timelock", async () => {
      const tx = vestingVault
        .connect(signers[1])
        .setTimelock(signers[0].address);
      await expect(tx).to.be.revertedWith("!timelock");
    });
    it("correctly changes the timelock", async () => {
      await vestingVault.connect(signers[0]).setTimelock(signers[1].address);

      const timelock = await vestingVault.timelock();
      expect(timelock).to.be.eq(signers[1].address);
    });
  });
  describe("setManager", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if caller is not the timelock", async () => {
      const tx = vestingVault
        .connect(signers[1])
        .setManager(signers[1].address);
      await expect(tx).to.be.revertedWith("!timelock");
    });
    it("correctly changes the manager", async () => {
      await vestingVault.connect(signers[0]).setManager(signers[1].address);
      const manager = await vestingVault.manager();
      expect(manager).to.be.eq(signers[1].address);
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
          0,
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
          0,
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
          0,
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
  describe("acceptGrant", async () => {
    before(async function () {
      await token.setBalance(signers[0].address, amount.mul(10));
      await token
        .connect(signers[0])
        .approve(vestingVault.address, amount.mul(10));
      await vestingVault.connect(signers[0]).deposit(amount.mul(10));
    });
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("fails if the caller's grant is not found", async () => {
      const tx = vestingVault.connect(signers[0]).acceptGrant();
      await expect(tx).to.be.revertedWith("no grant available");
    });
    it("accepts grant", async () => {
      const block = await getBlock();
      const vestingBalanceBefore = await token.balanceOf(signers[1].address);
      const userBalanceBefore = await token.balanceOf(vestingVault.address);
      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          0,
          block + 11,
          block + 6,
          ethers.constants.AddressZero
        );
      await token.connect(signers[1]).approve(vestingVault.address, amount);
      await vestingVault.connect(signers[1]).acceptGrant();

      const vestingBalanceAfter = await token.balanceOf(signers[1].address);
      const userBalanceAfter = await token.balanceOf(vestingVault.address);

      const grant = await vestingVault.getGrant(signers[1].address);
      console.log();
      expect(grant[7][0]).to.be.eq(0);
      expect(grant[7][1]).to.be.eq(amount);
      expect(vestingBalanceBefore).to.be.eq(vestingBalanceAfter);
      expect(userBalanceBefore).to.be.eq(userBalanceAfter);
    });
    it("accepts grant after initial withdrawal", async () => {
      const vestingBalanceBefore = await token.balanceOf(signers[1].address);
      const userBalanceBefore = await token.balanceOf(vestingVault.address);
      const block = await getBlock();
      await vestingVault
        .connect(signers[0])
        .addGrantAndDelegate(
          signers[1].address,
          amount,
          0,
          block + 7,
          block + 2,
          ethers.constants.AddressZero
        );

      await token.connect(signers[1]).approve(vestingVault.address, amount);
      //await vestingVault.connect(signers[1]).acceptGrant();

      // withdraw some non-zero amount
      await vestingVault.connect(signers[1]).claim();
      const withdrawn = await token.balanceOf(signers[1].address);
      expect(withdrawn).to.be.gt(0);

      // accept grant
      await token.connect(signers[1]).approve(vestingVault.address, amount);
      await vestingVault.connect(signers[1]).acceptGrant();

      // make sure the bound excludes withdrawn value
      let grant = await vestingVault.getGrant(signers[1].address);
      expect(grant[7][0]).to.be.eq(0);
      expect(grant[7][1]).to.be.eq(amount.sub(withdrawn));

      await advanceBlocks(provider, 3);

      await vestingVault.connect(signers[1]).claim();

      // check that the bound has moved down to 0 after the full grant is claimed
      grant = await vestingVault.getGrant(signers[1].address);
      expect(grant[7][0]).to.be.eq(0);
      expect(grant[7][1]).to.be.eq(0);
    });
    it("accept grant and withdraw correctly moves bound", async () => {
      for (let i = 0; i <= 2; i++) {
        const block = await getBlock();
        await vestingVault
          .connect(signers[0])
          .addGrantAndDelegate(
            signers[i].address,
            amount,
            0,
            block + 7,
            block + 2,
            ethers.constants.AddressZero
          );

        await token.connect(signers[i]).approve(vestingVault.address, amount);
        await vestingVault.connect(signers[i]).acceptGrant();

        let grant = await vestingVault.getGrant(signers[i].address);
        expect(grant[7][0]).to.be.eq(amount.mul(i));

        // loop to incrementally reach a full claim
        for (let q = 0; q < 4; q++) {
          await vestingVault.connect(signers[i]).claim();

          grant = await vestingVault.getGrant(signers[i].address);

          const userBalance = await token.balanceOf(signers[i].address);
          const expected = grant[0].sub(grant[7][1].sub(grant[7][0]));

          // validate the bound for each incremental withdraw
          expect(expected).to.be.eq(userBalance);
        }
      }
    });
  });
});
