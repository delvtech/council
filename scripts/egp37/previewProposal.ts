import fs from "fs";
import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { ProposalArgs } from "src/types";

import addressesJson from "src/addresses";
import { Timelock__factory, Treasury__factory } from "typechain";
import { createCallHash } from "src/helpers/createCallHash";

const { PRIVATE_KEY } = process.env;
const delvWalletAddress = "0xF6094C3A380AD6161Fb8240F3043392A0E427CAC";

//*************************************************//
// Returns arguments to transfer funds from the treasury to the delv wallet.
//*************************************************//
export async function previewProposal() {
  if (!PRIVATE_KEY) {
    console.log("NO PRIVATE KEY, EXITING");
    return;
  }

  const { treasury, elementToken, timeLock } = addressesJson.addresses;

  console.log("getting the proposal arguments");

  const proposalArgs = await getProposalArgs(treasury, elementToken, timeLock);

  const data = JSON.stringify(proposalArgs, null, 2);
  fs.writeFileSync("scripts/egp37/proposalArgs.json", data);
}

export async function getProposalArgs(
  treasuryAddress: string,
  tokenAddress: string,
  timeLockAddress: string
): Promise<ProposalArgs> {
  // Actual proposal actions.
  const treasuryInterface = new ethers.utils.Interface(Treasury__factory.abi);
  const callDataSendFunds = treasuryInterface.encodeFunctionData("sendFunds", [
    tokenAddress,
    parseEther(String(1_400_000)),
    delvWalletAddress,
  ]);

  // Calldatas and targets to be executed from the Timelock
  const calldatasTimeLock = [callDataSendFunds];
  const targetsTimeLock = [treasuryAddress];
  // Hash of of the Timelock calldatas and targets
  const callHashTimelock = await createCallHash(
    calldatasTimeLock,
    targetsTimeLock
  );

  // CoreVoting proposal is a 'registerCall' on the Timelock with the hash above.
  const timeLockInterface = new ethers.utils.Interface(Timelock__factory.abi);
  const calldataCoreVoting = timeLockInterface.encodeFunctionData(
    "registerCall",
    [callHashTimelock]
  );

  // The proposal hash is the CoreVoting targets and calldatas.
  const targets = [timeLockAddress];
  const callDatas = [calldataCoreVoting];
  const proposalHash = await createCallHash(callDatas, targets);

  return {
    targets,
    callDatas,
    proposalHash,
    targetsTimeLock,
    calldatasTimeLock,
    callHashTimelock,
  };
}
