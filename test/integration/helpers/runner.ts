import { loadGovernance } from "./deploy";
import { Signer, BigNumber } from "ethers";
import { expect } from "chai";
import { RunnerInput } from "./runnerInputs";
import { hashAccount } from "../../helpers/merkle";

import {
  advanceTime,
  advanceBlocks,
  getBlock,
  getTimestamp,
} from "../../helpers/time";
import "module-alias/register";

import { ethers, waffle } from "hardhat";

const { provider } = waffle;
const one = ethers.utils.parseEther("1");

export const Runner = {
  cv_init_success: (input: RunnerInput) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async function (resolve, reject) {
      const id = await input.governance.coreVoting.proposalCount();
      await input.governance.coreVoting
        .connect(input.signers[0])
        .proposal(
          input.votingVaults,
          input.coreVotingExtraData,
          input.coreVotingTargets,
          input.coreVotingCalldatas,
          1000000000000,
          input.ballot
        );
      const proposals = await input.governance.coreVoting.proposals(id);
      input.proposalID = id.toNumber();
      expect(proposals[id.toNumber()]).to.not.equal(0);
      console.log(`success: cv_init_success - "${input.description}"`);
      resolve(null);
    });
  },
  /**
   * Passes the vote that would be created using `input`
   * @dev Validates that the proposal has passed, but does not
   * validate if the call passed
   * @param {RunnerInput} input Object
   * that contains the init parameters
   */
  cv_pass: async (input: RunnerInput) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async function (resolve) {
      let proposal = await input.governance.coreVoting.proposals(
        input.proposalID
      );
      const blockNow = await getBlock(provider);

      // vote to pass quorum
      let extraData = "0x00";
      for (const i in input.signers) {
        // if this is the GSC vault don't calculate extra data
        if (input.votingVaults.length > 1) {
          const proof = input.governance.merkle.getHexProof(
            await hashAccount({
              address: input.signers[i].address,
              value: one,
            })
          );
          extraData = ethers.utils.defaultAbiCoder.encode(
            ["uint256", "bytes32[]"],
            [one, proof]
          );
        }
        await input.governance.coreVoting.connect(input.signers[i]).vote(
          //slice to create copy
          input.votingVaults,
          input.coreVotingExtraData.slice(0, 2).concat(extraData),
          input.proposalID,
          0
        );
      }
      // advance time only if needed to make the proposal executable
      if (blockNow < proposal.unlock.toNumber()) {
        await advanceBlocks(provider, proposal.unlock.toNumber() - blockNow);
      }

      await input.governance.coreVoting
        .connect(input.signers[0])
        .execute(
          input.proposalID,
          input.coreVotingTargets,
          input.coreVotingCalldatas
        );
      proposal = await input.governance.coreVoting.proposals(input.proposalID);
      expect(proposal[input.proposalID]).to.equal(ethers.constants.HashZero);
      console.log(`success: cv_pass - "${input.description}"`);

      resolve(null);
    });
  },
  /**
   * Ensures that a premature execution of a timelock call fails
   *
   * @param {RunnerInput} input Object
   * that contains the execution parameters
   */
  tl_fail_premature: async (input: RunnerInput) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async function (resolve) {
      const tx = input.governance.timelock
        .connect(input.signers[0])
        .execute(input.timelockTargets, input.timelockCalldatas);
      await expect(tx).to.be.revertedWith("not enough time has passed");
      console.log(`success: tl_fail_premature - "${input.description}"`);
      resolve(null);
    });
  },
  /**
   * Executes a timelock call.
   * @dev Validates execution by checking if the call timestamp was deleted.
   * This should also validate execution since timelock reverts on call() fail
   *
   * @param {RunnerInput} input Object
   * that contains the execution parameters
   */
  tl_pass: async (input: RunnerInput) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async function (resolve) {
      const timeNow = await getTimestamp(provider);
      const waittime = (await input.governance.timelock.waitTime()).toNumber();
      let calltimestamp = (
        await input.governance.timelock.callTimestamps(input.timelockCallHash)
      ).toNumber();

      // advance time only if needed to make the proposal executable
      if (timeNow < calltimestamp + waittime) {
        await advanceTime(provider, calltimestamp + waittime - timeNow);
      }
      await input.governance.timelock
        .connect(input.signers[0])
        .execute(input.timelockTargets, input.timelockCalldatas);

      calltimestamp = (
        await input.governance.timelock.callTimestamps(input.timelockCallHash)
      ).toNumber();
      expect(calltimestamp).to.equal(0);
      console.log(`success: tl_pass - "${input.description}"`);
      resolve(null);
    });
  },
  /**
   * Executes a timelock call.
   * @dev Validates execution bu checking if the call timestamp was deleted.
   * This should also validate execution since timelock reverts on call() fail
   *
   * @param {RunnerInput} input Object
   * that contains the execution parameters
   */
  tl_fail: async (input: RunnerInput) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async function (resolve) {
      const timeNow = await getTimestamp(provider);
      const waittime = (await input.governance.timelock.waitTime()).toNumber();
      let calltimestamp = (
        await input.governance.timelock.callTimestamps(input.timelockCallHash)
      ).toNumber();

      // advance time only if needed to make the proposal executable
      if (timeNow < calltimestamp + waittime) {
        await advanceTime(provider, calltimestamp + waittime - timeNow);
      }
      await input.governance.timelock
        .connect(input.signers[0])
        .execute(input.timelockTargets, input.timelockCalldatas);
      calltimestamp = (
        await input.governance.timelock.callTimestamps(input.timelockCallHash)
      ).toNumber();
      expect(calltimestamp).to.equal(0);
      console.log(`success: tl_pass - "${input.description}"`);
      resolve(null);
    });
  },
  run_checks: async (input: RunnerInput) => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async function (resolve) {
      for (let i = 0; i < input.checks.length; i++) {
        await input.checks[i]();
      }
      console.log(`success: run_checks - "${input.description}"`);
      resolve(null);
    });
  },
  // eslint-disable-next-line
  runPath: async (...path: Function[]) => {
    return iterate();

    async function iterate() {
      if (!path.length) return;
      await (path.shift() as () => Promise<any>)();
      await iterate();
    }
  },
};
