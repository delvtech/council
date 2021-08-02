import "module-alias/register";

import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumberish, BigNumber } from "ethers";
import { Spender } from "../typechain/Spender";
import { MockERC20 } from "../typechain/MockERC20";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

const { provider } = waffle;

describe("Locking Vault", function () {
  // We use the history tracker and signers in each test
  let spender: Spender;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  let token: MockERC20;
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
    token = await erc20Deployer.deploy("Ele", "test ele");

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
  });

  // After we reset our state in the fork
  after(async () => {
    await restoreSnapshot(provider);
  });
  // Before each we snapshot
  beforeEach(async () => {
    // fund the spending address
    token.setBalance(spender.address, one.mul(100));
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
    await spender.largeSpend(high.sub(1), signers[3].address);
    const balance = await token.balanceOf(signers[3].address);
    expect(balance).to.be.eq(high.sub(1));
  });

  it("High spend can't spend over the limit", async () => {
    const tx = spender.largeSpend(high.add(1), signers[3].address);
    await expect(tx).to.be.revertedWith("Spend Limit Exceeded");
  });
});
