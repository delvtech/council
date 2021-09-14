import { ethers, waffle } from "hardhat";
import { Governance, loadGovernance } from "./helpers/deploy";
import { createSnapshot, restoreSnapshot } from "../helpers/snapshots";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
//import { Runner } from "./helpers/runner";
import { Runner } from "./helpers/runner2";

import {
  getInputs,
  RunnerMods,
  RunnerInput,
  RunnerInputs,
} from "./helpers/runnerInputs";
import { expect } from "chai";
import { doesNotMatch } from "assert";
import mocha1 from "mocha";

const { provider } = waffle;
describe.only("Integration", function () {
  const zeroExtraData = ["0x", "0x", "0x", "0x"];
  let inputs: RunnerInput[];
  let signers: SignerWithAddress[];
  let governance: Governance;
  before(async function () {
    signers = await ethers.getSigners();
    governance = await loadGovernance(signers);
    await createSnapshot(provider);
    inputs = await getInputs(governance, signers);
  });
  after(async () => {
    await restoreSnapshot(provider);
  });

  it("Upgrades some vaults and do some things", async function () {
    const vvupgrade = await RunnerMods.upgradeVestingVault(
      governance,
      signers,
      inputs[0]
    );
    const lvupgrade = await RunnerMods.upgradeLockingVault(
      governance,
      signers,
      inputs[0]
    );

    const upgradeVesting = Runner.runPath.bind(
      Runner,
      Runner.cv_init_success.bind(Runner, vvupgrade),
      Runner.cv_pass.bind(Runner, vvupgrade),
      Runner.tl_fail_premature.bind(Runner, vvupgrade),
      Runner.tl_pass.bind(Runner, vvupgrade),
      Runner.run_checks.bind(Runner, vvupgrade)
    );
    const upgradeLocking = Runner.runPath.bind(
      Runner,
      Runner.cv_init_success.bind(Runner, lvupgrade),
      Runner.cv_pass.bind(Runner, lvupgrade),
      Runner.tl_fail_premature.bind(Runner, lvupgrade),
      Runner.tl_pass.bind(Runner, lvupgrade),
      Runner.run_checks.bind(Runner, lvupgrade)
    );
    const upgradeWaitTime = Runner.runPath.bind(
      Runner,
      Runner.cv_init_success.bind(Runner, inputs[0]),
      Runner.cv_pass.bind(Runner, inputs[0]),
      Runner.tl_fail_premature.bind(Runner, inputs[0]),
      Runner.tl_pass.bind(Runner, inputs[0]),
      Runner.run_checks.bind(Runner, inputs[0])
    );
    await Runner.runPath(
      upgradeWaitTime,
      upgradeVesting,
      upgradeLocking,
      upgradeWaitTime
    );
  });
  it("Integration", async function () {
    expect(1).to.equal(1);
  });
});
