import "module-alias/register";

import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Spender } from "../typechain/Spender";
import { MockERC20 } from "../typechain/MockERC20";
import { MockDoubleSpender } from "../typechain/MockDoubleSpender";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

const { provider } = waffle;

describe("Spender Feature", function () {
  // We use the history tracker and signers in each test
  let spender: Spender;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  let token: MockERC20;
  let doubler: MockDoubleSpender;
  const one = ethers.utils.parseEther("1");
  const low = one;
  const mid = one.mul(2);
  const high = one.mul(3);

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

    const spenderDeployer = await ethers.getContractFactory(
      "Spender",
      signers[0]
    );
    spender = await spenderDeployer.deploy(
      signers[1].address,
      signers[0].address,
      token.address,
      low,
      mid,
      high
    );

    const doublerDeployer = await ethers.getContractFactory(
      "MockDoubleSpender",
      signers[0]
    );
    doubler = await doublerDeployer.deploy();

    await token.setBalance(spender.address, one.mul(100));
    await spender.connect(signers[1]).authorize(doubler.address);
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

  it("Small spend spend up to the low limit", async () => {
    // try to spend up to the low limit
    await spender.smallSpend(low.sub(1), signers[3].address);
    const balance = await token.balanceOf(signers[3].address);
    expect(balance).to.be.eq(low.sub(1));
  });

  it("Small spend can't spend over the limit", async () => {
    const tx = spender.smallSpend(low.add(1), signers[3].address);
    await expect(tx).to.be.revertedWith("Spend Limit Exceeded");
  });

  it("Medium spend spend up to the medium limit", async () => {
    // try to spend up to the medium limit
    await spender.mediumSpend(mid.sub(1), signers[3].address);
    const balance = await token.balanceOf(signers[3].address);
    expect(balance).to.be.eq(mid.sub(1));
  });

  it("Mid spend can't spend over the limit", async () => {
    const tx = spender.mediumSpend(mid.add(1), signers[3].address);
    await expect(tx).to.be.revertedWith("Spend Limit Exceeded");
  });

  it("High spend spend up to the high limit", async () => {
    // try to spend up to the high limit
    await spender.highSpend(high.sub(1), signers[3].address);
    const balance = await token.balanceOf(signers[3].address);
    expect(balance).to.be.eq(high.sub(1));
  });

  it("High spend can't spend over the limit", async () => {
    const tx = spender.highSpend(high.add(1), signers[3].address);
    await expect(tx).to.be.revertedWith("Spend Limit Exceeded");
  });

  it("Can't spend more than the low limit in one block", async () => {
    const tx = doubler.doubleSpendSmall(spender.address, low.sub(1));
    await expect(tx).to.be.revertedWith("Spend Limit Exceeded");
  });

  it("Can't spend more than the mid limit in one block", async () => {
    const tx = doubler.doubleSpendMedium(spender.address, mid.sub(1));
    await expect(tx).to.be.revertedWith("Spend Limit Exceeded");
  });

  it("Can't spend more than the high limit in one block", async () => {
    const tx = doubler.doubleSpendLarge(spender.address, high.sub(1));
    await expect(tx).to.be.revertedWith("Spend Limit Exceeded");
  });

  it("Doesn't allow non owner to set limits", async () => {
    const tx = spender.setLimits([0, 0, 0]);
    await expect(tx).to.be.revertedWith("Sender not owner");
  });

  it("Doesn't allow non authorized to spend low", async () => {
    const tx = spender
      .connect(signers[1])
      .smallSpend(low.sub(1), signers[3].address);
    await expect(tx).to.be.revertedWith("Sender not Authorized");
  });

  it("Doesn't allow non authorized to spend mid", async () => {
    const tx = spender
      .connect(signers[1])
      .mediumSpend(low.sub(1), signers[3].address);
    await expect(tx).to.be.revertedWith("Sender not Authorized");
  });

  it("Doesn't allow non authorized to spend high", async () => {
    const tx = spender
      .connect(signers[1])
      .highSpend(low.sub(1), signers[3].address);
    await expect(tx).to.be.revertedWith("Sender not Authorized");
  });

  it("doesn't allow non owner to remove tokens", async () => {
    const tx = spender.removeToken(low.sub(1), signers[3].address);
    await expect(tx).to.be.revertedWith("Sender not owner");
  });

  it("Allows owner to set limits", async () => {
    await spender.connect(signers[1]).setLimits([1, 2, 3]);
    expect(await spender.smallSpendLimit()).to.be.eq(1);
    expect(await spender.mediumSpendLimit()).to.be.eq(2);
    expect(await spender.highSpendLimit()).to.be.eq(3);
  });

  it("Allows owner to transfer out token", async () => {
    await spender.connect(signers[1]).removeToken(low, signers[3].address);
    expect(await token.balanceOf(signers[3].address)).to.be.eq(low);
  });
});
