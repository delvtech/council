import { ethers, waffle } from "hardhat";
import { Governance, loadGovernance } from "./helpers/deploy";
import { createSnapshot, restoreSnapshot } from "../helpers/snapshots";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Runner } from "./helpers/runner";
import { getBlock } from "../helpers/time";
import { RunnerMods, RunnerInput, RunnerInputs } from "./helpers/runnerInputs";
import { expect } from "chai";
import { Wallet } from "ethers";

const { provider } = waffle;
describe("Storage stress test", function () {
  let input: RunnerInput;
  let signers: SignerWithAddress[];
  let governance: Governance;

  async function updateLockingVault(
    input: RunnerInput,
    signers: SignerWithAddress[],
    governance: Governance
  ) {
    const lockingVaultUpgrade = await RunnerMods.upgradeLockingVault(
      governance,
      signers,
      input
    );
    const upgradeLocking = Runner.runPath.bind(
      Runner,
      Runner.cv_init_success.bind(Runner, lockingVaultUpgrade),
      Runner.cv_pass.bind(Runner, lockingVaultUpgrade),
      Runner.tl_fail_premature.bind(Runner, lockingVaultUpgrade),
      Runner.tl_pass.bind(Runner, lockingVaultUpgrade),
      Runner.run_checks.bind(Runner, lockingVaultUpgrade)
    );
    await Runner.runPath(upgradeLocking);
  }
  before(async function () {
    signers = await ethers.getSigners();
    governance = await loadGovernance(signers);
    await createSnapshot(provider);
    input = await RunnerInputs.updateWaitTimeInput(governance, signers);
  });
  after(async () => {
    await restoreSnapshot(provider);
  });

  it("stress-test storage library", async function () {
    // array of addresses that can have voting power
    const addresses = [];
    // number of voting power depositors
    const count = 10;
    const deposit = ethers.utils.parseEther("1");
    for (let i = 0; i < count; i++) {
      console.log("setting voting for account " + i);
      const random = Math.floor(Math.random() * i);
      const wallet: Wallet = ethers.Wallet.createRandom().connect(provider);
      addresses.push(wallet.address);
      // fund the wallet with some gas
      await signers[0].sendTransaction({
        to: wallet.address,
        value: deposit,
      });
      await governance.token.setBalance(wallet.address, deposit);
      await governance.token
        .connect(wallet)
        .approve(governance.lockingVault.address, deposit);
      await governance.lockingVault
        .connect(wallet)
        //.deposit(wallet.address, deposit, addresses[random])
        .deposit(wallet.address, deposit, addresses[random]);
    }

    await updateLockingVault(input, signers, governance);

    const blockNow = await getBlock(provider);

    let cumulative = ethers.BigNumber.from("0");
    for (let i = 0; i < addresses.length; i++) {
      let power;
      try {
        power = await governance.lockingVault.queryVotePowerView(
          addresses[i],
          blockNow
        );
      } catch {
        power = ethers.BigNumber.from("0");
      }
      cumulative = cumulative.add(power);
    }
    expect(cumulative).to.equal(deposit.mul(count));
  });
});
