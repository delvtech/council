import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { LockingVault, MockERC20, NonvotingVault } from "typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

const { provider } = waffle;

describe.only("Nonvoting Vault", function () {
  let vault: NonvotingVault;
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
      "NonvotingVault",
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

  describe("Withdraw", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    it("withdraws properly", async () => {
      // Set up the locking vault
      // Setup a user and give account some voting power
      await lockingVault.deposit(signers[0].address, one, signers[2].address);
      const balanceBefore = await token.balanceOf(signers[0].address);
      const tx = await (await vault.withdraw(one.div(2))).wait();
      const balanceAfter = await token.balanceOf(signers[0].address);
      expect(balanceAfter.sub(balanceBefore)).to.be.eq(one.div(2));
    });
    it("fails if not authorized", async () => {
      // attempts a withdraw as a non authorized user
      const tx = vault.connect(signers[1]).withdraw(one);
      await expect(tx).to.be.revertedWith("Sender not Authorized");
    });
  });
});
