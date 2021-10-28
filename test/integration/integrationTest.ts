import { ethers, waffle } from "hardhat";
import { Governance, loadGovernance } from "./helpers/deploy";
import { createSnapshot, restoreSnapshot } from "../helpers/snapshots";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Runner } from "./helpers/runner";
import { RunnerMods, RunnerInputs } from "./helpers/runnerInputs";

const { provider } = waffle;
describe("Integration", function () {
  let signers: SignerWithAddress[];
  let governance: Governance;
  before(async function () {
    signers = await ethers.getSigners();
    governance = await loadGovernance(signers);
    await createSnapshot(provider);
  });
  after(async () => {
    await restoreSnapshot(provider);
  });

  it("GSC proposal on setIdleDuration ", async function () {
    const gscProposalSubmitInput = await RunnerInputs.gscProposalSubmit(
      governance,
      signers
    );
    const gscProposalPassInput = await RunnerInputs.gscProposalPass(
      governance,
      signers
    );

    // set voting contract to to the GSC core voting
    const { coreVoting } = gscProposalSubmitInput.governance;
    gscProposalSubmitInput.governance.coreVoting =
      gscProposalSubmitInput.governance.gscCoreVoting;

    await Runner.runPath(
      Runner.cv_init_success.bind(Runner, gscProposalSubmitInput),
      Runner.cv_pass.bind(Runner, gscProposalSubmitInput)
    );

    // set voting contract to to the core voting
    gscProposalSubmitInput.governance.coreVoting = coreVoting;
    const id = await coreVoting.proposalCount();
    gscProposalPassInput.proposalID = id.toNumber() - 1;

    await Runner.runPath(
      Runner.cv_pass.bind(Runner, gscProposalPassInput),
      Runner.tl_pass.bind(Runner, gscProposalPassInput),
      Runner.run_checks.bind(Runner, gscProposalPassInput)
    );
  });

  it("update timelock wait time from GSC Core Voting", async function () {
    const input = await RunnerInputs.increaseWaitTime(governance, signers);

    // set voting contract to to the GSC core voting
    const { coreVoting } = input.governance;
    input.governance.coreVoting = input.governance.gscCoreVoting;

    await Runner.runPath(
      Runner.cv_init_success.bind(Runner, input),
      Runner.cv_pass.bind(Runner, input),
      Runner.run_checks.bind(Runner, input)
    );
    // set voting contract to the core voting
    input.governance.coreVoting = coreVoting;
  });
  it("Upgrades vaults and core", async function () {
    let input = await RunnerInputs.updateWaitTimeInput(governance, signers);
    const vestingVaultUpgrade = await RunnerMods.upgradeVestingVault(
      governance,
      signers,
      input
    );
    // runs the vesting vault upgrade
    await Runner.runPath(
      Runner.cv_init_success.bind(Runner, vestingVaultUpgrade),
      Runner.cv_pass.bind(Runner, vestingVaultUpgrade),
      Runner.tl_pass.bind(Runner, vestingVaultUpgrade),
      Runner.run_checks.bind(Runner, vestingVaultUpgrade)
    );

    const lockingVaultUpgrade = await RunnerMods.upgradeLockingVault(
      governance,
      signers,
      input
    );
    // runs the locking vault upgrade
    await Runner.runPath(
      Runner.cv_init_success.bind(Runner, lockingVaultUpgrade),
      Runner.cv_pass.bind(Runner, lockingVaultUpgrade),
      Runner.tl_pass.bind(Runner, lockingVaultUpgrade),
      Runner.run_checks.bind(Runner, lockingVaultUpgrade)
    );

    const cvUpgrade = await RunnerMods.upgradeCoreVoting(
      governance,
      signers,
      input
    );
    // runs the coreVoting upgrade
    await Runner.runPath(
      Runner.cv_init_success.bind(Runner, cvUpgrade),
      Runner.cv_pass.bind(Runner, cvUpgrade),
      Runner.run_checks.bind(Runner, cvUpgrade)
    );

    // timelock upgrade passing the previous timelock address so it is not redeployed
    // upgrading the timelock is a little bit more involved given that it is a very central component.
    // The upgradeTimelock Runner Mod implements logic to update ownership from both the GSC and coreVoting vaults
    // using separate calls.

    const originalTimelock = governance.timelock;
    let tlUpgrade = await RunnerMods.upgradeTimelock(
      governance,
      signers,
      input
    );

    // upgrade timelock part 1. Creates new timelock and sets it to be the GSC CoreVoting owner
    await Runner.runPath(
      Runner.cv_init_success.bind(Runner, tlUpgrade),
      Runner.cv_pass.bind(Runner, tlUpgrade),
      Runner.tl_pass.bind(Runner, tlUpgrade),
      Runner.run_checks.bind(Runner, tlUpgrade)
    );

    tlUpgrade = await RunnerMods.upgradeTimelock(
      governance,
      signers,
      input,
      governance.timelock,
      originalTimelock
    );

    // upgrade timelock part 2. submits and passes a proposal to change toe CoreVoting owner to the new timelock.
    await Runner.runPath(
      Runner.cv_init_success.bind(Runner, tlUpgrade),
      Runner.cv_pass.bind(Runner, tlUpgrade),
      Runner.tl_pass.bind(Runner, tlUpgrade),
      Runner.run_checks.bind(Runner, tlUpgrade)
    );

    // run a simple CoreVoting to Timelock action after everything
    input = await RunnerInputs.updateWaitTimeInput(governance, signers);

    await Runner.runPath(
      Runner.cv_init_success.bind(Runner, input),
      Runner.cv_pass.bind(Runner, input),
      Runner.tl_fail_premature.bind(Runner, input),
      Runner.tl_pass.bind(Runner, input),
      Runner.run_checks.bind(Runner, input)
    );
  });
});
