import fs from "fs";
import hre from "hardhat";
import { CoreVoting__factory } from "typechain";

import addressesJson from "src/addresses";
import { DAY_IN_BLOCKS } from "src/constants";
import { ProposalArgs, ProposalInfo } from "src/types";
import { Wallet } from "ethers";
import { sleep } from "src/helpers/sleep";
import { getSigner } from "scripts/helpers/getSigner";

const { NUM_DAYS_TO_EXECUTE, BALLOT } = process.env;

const { provider } = hre.ethers;

/**
 * Creates the transfer funds prooposal
 */
export async function createProposal(signer: Wallet | undefined) {
  if (!NUM_DAYS_TO_EXECUTE) {
    return;
  }

  signer = signer || (await getSigner());
  if (!signer) {
    return;
  }
  await sleep(1_000);

  const { coreVoting, lockingVault } = addressesJson.addresses;

  console.log("creating proposal egp-39");

  const rawdata = fs.readFileSync("scripts/egp39/proposalArgs.json");
  const args: ProposalArgs = JSON.parse(rawdata.toString());
  const {
    targets,
    callDatas,
    proposalHash,
    targetsTimeLock,
    calldatasTimeLock,
    callHashTimelock,
  } = args;

  // create the arguments to coreVoting.proposal()
  const ballot = Number(BALLOT) ?? 0; // 0 - YES, 1 - NO, 2 - ABSTAIN
  console.log("ballot", ballot);
  if (signer.address !== process.env.TEST_SIGNER_ADDRESS && ballot !== 2) {
    console.log("process.env.TEST_SIGNER", process.env.TEST_SIGNER);
    console.log("signer", signer.address);
    throw new Error("Only ABSTAIN is allowed for creating proposals");
  }

  const coreVotingContract = CoreVoting__factory.connect(coreVoting, signer);

  // last chance to execute to vote is ~ NUM_DAYS_TO_EXECUTE days from now
  const currentBlock = await provider.getBlockNumber();
  const lastCall = Math.round(
    DAY_IN_BLOCKS * Number(NUM_DAYS_TO_EXECUTE) + currentBlock
  );
  const votingVaultAddresses = [lockingVault];
  const extraVaultData = ["0x00"];

  const tx = await coreVotingContract.proposal(
    votingVaultAddresses,
    extraVaultData,
    targets,
    callDatas,
    lastCall,
    ballot
  );

  await tx.wait(1);

  // just getting the proposalId
  const proposalCreatedEvents = await coreVotingContract.queryFilter(
    coreVotingContract.filters.ProposalCreated(),
    currentBlock
  );
  const proposalId = proposalCreatedEvents[0].args[0].toNumber();

  const proposalArgs = [
    ["proposalId", proposalId],
    ["votingVaults", votingVaultAddresses],
    ["extraVaultData", extraVaultData],
    ["targets", targets],
    ["callDatas", callDatas],
    ["proposalHash", proposalHash],
    ["targetsTimeLock", targetsTimeLock],
    ["calldatasTimeLock", calldatasTimeLock],
    ["callHashTimelock", callHashTimelock],
    ["lastCall", lastCall],
    ["ballot", ballot],
  ];

  console.log(`Proposal ${proposalId} created.`);

  const proposalInfo: ProposalInfo = Object.fromEntries(proposalArgs);
  const data = JSON.stringify(proposalInfo, null, 2);
  fs.writeFileSync("scripts/egp39/proposalInfo.json", data);
}
