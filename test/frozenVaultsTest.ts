import "module-alias/register";

import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { FrozenLockingVault } from "typechain/FrozenLockingVault";
import { MockERC20 } from "typechain/MockERC20";
import { FrozenVestingVault } from "../typechain/FrozenVestingVault";

const { provider } = waffle;

describe("Frozen Vaults", function () {
  // We use the history tracker and signers in each test
  let lockingVault: FrozenLockingVault;
  let vestingVault: FrozenVestingVault;
  let token: MockERC20;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];
  const one = ethers.utils.parseEther("1");
  const zeroAddress = "0x0000000000000000000000000000000000000000";

  before(async function () {
    signers = await ethers.getSigners();
    // deploy the token;
    const erc20Deployer = await ethers.getContractFactory(
      "MockERC20",
      signers[0]
    );
    token = await erc20Deployer.deploy("Ele", "test ele", signers[0].address);

    // deploy the contract
    const deployer = await ethers.getContractFactory(
      "FrozenLockingVault",
      signers[0]
    );
    lockingVault = await deployer.deploy(token.address, 199350);

    const vestingVaultDeployer = await ethers.getContractFactory(
      "FrozenVestingVault",
      signers[0]
    );
    vestingVault = await vestingVaultDeployer.deploy(token.address, 199350);
  });

  describe("No calls allowed", async () => {
    it("Cannot call locking vault withdraw", async () => {
      const tx = lockingVault.withdraw(0);
      await expect(tx).to.be.revertedWith("Frozen");
    });

    it("Cannot call vesting vault withdraw", async () => {
      const tx = vestingVault.withdraw(0, signers[0].address);
      await expect(tx).to.be.revertedWith("Frozen");
    });

    it("Cannot call vesting vault claim", async () => {
      const tx = vestingVault.claim();
      await expect(tx).to.be.revertedWith("Frozen");
    });

    it("Cannot call vesting vault remove", async () => {
      const tx = vestingVault.removeGrant(signers[0].address);
      await expect(tx).to.be.revertedWith("Frozen");
    });
  });
});
