import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { LockingVault, MockERC20, NonVotingVault } from "typechain";

const { provider } = waffle;

describe("Nonvoting Vault", function () {
  let vault: NonVotingVault;
  let signers: SignerWithAddress[];

  let lockingVault: LockingVault;
  let token: MockERC20;
  const one = ethers.utils.parseEther("1");

  before(async () => {
    // Create a before snapshot
    await createSnapshot(provider);
    signers = await ethers.getSigners();

    // deploy a token for the locking vault
    const erc20Deployer = await ethers.getContractFactory(
      "MockERC20",
      signers[0]
    );
    token = await erc20Deployer.deploy("Ele", "test ele", signers[0].address);

    // deploy the locking vault
    const lockingDeployer = await ethers.getContractFactory(
      "LockingVault",
      signers[0]
    );
    lockingVault = await lockingDeployer.deploy(token.address, 199350);

    // deploy the nonvoting vault contract
    const deployer = await ethers.getContractFactory(
      "NonVotingVault",
      signers[0]
    );
    vault = await deployer.deploy(signers[0].address, lockingVault.address);

    // Give user some balance and set their allowance
    await token.setBalance(
      signers[0].address,
      ethers.utils.parseEther("100000")
    );
    await token.setAllowance(
      signers[0].address,
      lockingVault.address,
      ethers.constants.MaxUint256
    );
  });
  describe("Withdraw", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("withdraws properly", async () => {
      // Set up the locking vault
      await lockingVault.deposit(vault.address, one, signers[1].address);
      const balanceBefore = await token.balanceOf(signers[0].address);
      // Withdraw from the vault and check the account balance
      const tx = await (
        await vault.withdraw(one.div(2), signers[0].address)
      ).wait();
      const balanceAfter = await token.balanceOf(signers[0].address);
      expect(balanceAfter.sub(balanceBefore)).to.be.eq(one.div(2));
    });
    it("fails if not authorized", async () => {
      // attempts a withdraw as a non authorized user
      const tx = vault.connect(signers[1]).withdraw(one, signers[1].address);
      await expect(tx).to.be.revertedWith("Sender not owner");
    });
  });
});
