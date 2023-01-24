import fs from "fs";
import hre from "hardhat";
import { CoreVoting__factory } from "typechain";

import { DAY_IN_BLOCKS } from "src/constants";

import addressesJson from "../src/addresses";
import { ProposalInfo } from "src/types";

const { PRIVATE_KEY, NUM_DAYS_TO_EXECUTE, BALLOT } = process.env;
const RPC_HOST = "http://127.0.0.1:8545";

const provider = new hre.ethers.providers.JsonRpcProvider(RPC_HOST);

interface ProposalArgs {
  targets: string[];
  callDatas: string[];
  proposalHash: Promise<string>;
  targetsTimeLock: string[];
  calldatasTimeLock: string[];
  callHashTimelock: string;
}

/**
 * Creates the upgrade grants proposal
 */
export async function createUpgradeGrantsProposal() {
  if (!PRIVATE_KEY || !NUM_DAYS_TO_EXECUTE) {
    return;
  }

  // sisyphus.eth
  const signer = await hre.ethers.getImpersonatedSigner(
    "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
  );

  const { lockingVault, coreVoting } = addressesJson.addresses;

  console.log("creating the proposal");

  const rawdata = fs.readFileSync("proposalArgs.json");
  const args: ProposalArgs = JSON.parse(rawdata.toString());
  const {
    targets,
    callDatas,
    proposalHash,
    targetsTimeLock,
    calldatasTimeLock,
    callHashTimelock,
  } = args;

  const ballot = BALLOT ?? 0; // 0 - YES, 1 - NO, 2 - ABSTAIN

  // create the arguments to coreVoting.proposal()
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

  console.log("Proposal created with:");
  proposalArgs.forEach(([name, value]) => console.log(name, value));

  const proposalInfo: ProposalInfo = Object.fromEntries(proposalArgs);
  const data = JSON.stringify(proposalInfo, null, 2);
  fs.writeFileSync("proposalInfo.json", data);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
createUpgradeGrantsProposal()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
