import "module-alias/register";

import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumberish, BigNumber } from "ethers";
import { LockingVault } from "typechain/LockingVault";
import { MockERC20 } from "typechain/MockERC20";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

const { provider } = waffle;

describe("Locking Vault", function () {
  // We use the history tracker and signers in each test
  let vault: LockingVault;
  let token: MockERC20;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  const one = ethers.utils.parseEther("1");
  const zeroAddress = "0x0000000000000000000000000000000000000000";

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
      "LockingVault",
      signers[0]
    );
    vault = await deployer.deploy(token.address, 199350);

    // Give users some balance and set their allowance
    for (const signer of signers) {
      await token.setBalance(signer.address, ethers.utils.parseEther("100000"));
      await token.setAllowance(
        signer.address,
        vault.address,
        ethers.constants.MaxUint256
      );
    }
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

  describe("Deposit sequence", async () => {
    // Before each we snapshot
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    // After we reset our state in the fork
    afterEach(async () => {
      await restoreSnapshot(provider);
    });
    // Test the deposit by user for user
    it("Allows a user's first deposit to set gov power", async () => {
      // Deposit by calling from address 0 and delegating to address 1
      const tx = await (
        await vault.deposit(signers[0].address, one, signers[1].address)
      ).wait();
      const votingPower = await vault.queryVotePowerView(
        signers[1].address,
        tx.blockNumber
      );
      expect(votingPower).to.be.eq(one);
      // expect user 0 to have a deposits
      let userData = await vault.deposits(signers[0].address);
      expect(userData[0]).to.be.eq(signers[1].address);
      expect(userData[1]).to.be.eq(one);
      // expect address 1/2 to have zero deposit
      userData = await vault.deposits(signers[1].address);
      expect(userData[0]).to.be.eq(zeroAddress);
      expect(userData[1]).to.be.eq(0);
      userData = await vault.deposits(signers[2].address);
      expect(userData[0]).to.be.eq(zeroAddress);
      expect(userData[1]).to.be.eq(0);
    });
    it("Allows a user's first deposit to set their own power", async () => {
      // Deposit by calling from address 0 and delegating to address 1
      const tx = await (
        await vault.deposit(signers[0].address, one, signers[0].address)
      ).wait();
      const votingPower = await vault.queryVotePowerView(
        signers[0].address,
        tx.blockNumber
      );
      expect(votingPower).to.be.eq(one);
    });
    // Test the deposit by user not for user
    it("Allows someone else to add voting power on behalf of user", async () => {
      // Deposit by calling from address 2 to fund address 0 and delegate to address 1
      const tx = await (
        await vault
          .connect(signers[2])
          .deposit(signers[0].address, one, signers[1].address)
      ).wait();
      // expect address 1 to have voting power
      const votingPower = await vault.queryVotePowerView(
        signers[1].address,
        tx.blockNumber
      );
      expect(votingPower).to.be.eq(one);
      // expect address 0 to have a deposit
      let userData = await vault.deposits(signers[0].address);
      expect(userData[0]).to.be.eq(signers[1].address);
      expect(userData[1]).to.be.eq(one);
      // expect address 1/2 to have zero deposit
      userData = await vault.deposits(signers[1].address);
      expect(userData[0]).to.be.eq(zeroAddress);
      expect(userData[1]).to.be.eq(0);
      userData = await vault.deposits(signers[2].address);
      expect(userData[0]).to.be.eq(zeroAddress);
      expect(userData[1]).to.be.eq(0);
    });
    // Test deposit after user has already deposited once
    it("Does not let second deposit change the delegation", async () => {
      // Deposit by calling from address 2 to fund address 0 and delegate to address 1
      await vault.deposit(signers[0].address, one, signers[0].address);
      const tx = await (
        await vault
          .connect(signers[1])
          .deposit(signers[0].address, one, signers[1].address)
      ).wait();
      // expect address 1 to have voting power
      const votingPower = await vault.queryVotePowerView(
        signers[0].address,
        tx.blockNumber
      );
      expect(votingPower).to.be.eq(one.mul(2));
      // expect address 0 to have a deposit
      let userData = await vault.deposits(signers[0].address);
      expect(userData[0]).to.be.eq(signers[0].address);
      expect(userData[1]).to.be.eq(one.mul(2));
      // expect address 1/2 to have zero deposit
      userData = await vault.deposits(signers[1].address);
      expect(userData[0]).to.be.eq(zeroAddress);
      expect(userData[1]).to.be.eq(0);
      userData = await vault.deposits(signers[2].address);
      expect(userData[0]).to.be.eq(zeroAddress);
      expect(userData[1]).to.be.eq(0);
    });
  });

  it("Changes delegates properly", async () => {
    // First we setup the user and give accounts some voting power
    await vault.deposit(signers[0].address, one, signers[0].address);
    await vault
      .connect(signers[1])
      .deposit(signers[1].address, one.div(2), signers[0].address);
    await vault
      .connect(signers[2])
      .deposit(signers[2].address, one.mul(2), signers[2].address);
    // singer 0 has deposit 1 voting power 1.5, singer 1 has deposit 0.5 voting power 0, singer 2 has
    // deposit 2 voting power 2
    // we now change delegates
    const tx = await (await vault.changeDelegation(signers[2].address)).wait();
    // Check on all the deposits and delegations
    let userData = await vault.deposits(signers[0].address);
    expect(userData[0]).to.be.eq(signers[2].address);
    expect(userData[1]).to.be.eq(one);

    userData = await vault.deposits(signers[1].address);
    expect(userData[0]).to.be.eq(signers[0].address);
    expect(userData[1]).to.be.eq(one.div(2));

    userData = await vault.deposits(signers[2].address);
    expect(userData[0]).to.be.eq(signers[2].address);
    expect(userData[1]).to.be.eq(one.mul(2));

    // check the voting power
    const block = tx.blockNumber;
    let votingPower = await vault.queryVotePowerView(signers[0].address, block);
    expect(votingPower).to.be.eq(one.div(2));
    // The call to this query voting power method will fail on a length 0 array
    await expect(
      vault.queryVotePowerView(signers[1].address, block)
    ).to.be.revertedWith("uninitialized");
    votingPower = await vault.queryVotePowerView(signers[2].address, block);
    expect(votingPower).to.be.eq(one.mul(3));
  });

  it("Withdraws properly", async () => {
    // First we setup the user and give accounts some voting power
    await vault.deposit(signers[0].address, one, signers[2].address);
    await vault
      .connect(signers[1])
      .deposit(signers[1].address, one.div(2), signers[0].address);
    await vault
      .connect(signers[2])
      .deposit(signers[2].address, one.mul(2), signers[2].address);
    // We withdraw from user one and check the accounts
    const balanceBefore = await token.balanceOf(signers[0].address);
    const tx = await (await vault.withdraw(one.div(2))).wait();
    // We check that the user has increased balance
    const balanceAfter = await token.balanceOf(signers[0].address);
    expect(balanceAfter.sub(balanceBefore)).to.be.eq(one.div(2));
    // We now check all of the user vault and voting power
    // Check on all the deposits and delegations
    let userData = await vault.deposits(signers[0].address);
    expect(userData[0]).to.be.eq(signers[2].address);
    expect(userData[1]).to.be.eq(one.div(2));

    userData = await vault.deposits(signers[1].address);
    expect(userData[0]).to.be.eq(signers[0].address);
    expect(userData[1]).to.be.eq(one.div(2));

    userData = await vault.deposits(signers[2].address);
    expect(userData[0]).to.be.eq(signers[2].address);
    expect(userData[1]).to.be.eq(one.mul(2));

    // check the voting power
    const block = tx.blockNumber;
    let votingPower = await vault.queryVotePowerView(signers[0].address, block);
    expect(votingPower).to.be.eq(one.div(2));
    const queryTx = await (
      await vault.queryVotePower(signers[0].address, block, "0x")
    ).wait();
    // The call to this query voting power method will fail on a length 0 array
    await expect(
      vault.queryVotePowerView(signers[1].address, block)
    ).to.be.revertedWith("uninitialized");
    votingPower = await vault.queryVotePowerView(signers[2].address, block);
    expect(votingPower).to.be.eq(one.mul(2).add(one.div(2)));
  });
});
