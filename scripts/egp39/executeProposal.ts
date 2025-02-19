import fs from "fs";
import { CoreVoting__factory } from "typechain";

import addressesJson from "src/addresses";
import { sleep } from "src/helpers/sleep";
import { ProposalInfo } from "src/types";
import { getSigner } from "scripts/helpers/getSigner";
import { Wallet } from "ethers";

export async function executeProposal(signer: Wallet | undefined) {
  await sleep(1_000);

  signer = signer || (await getSigner());
  if (!signer) {
    return;
  }

  const { coreVoting } = addressesJson.addresses;
  const coreVotingContract = CoreVoting__factory.connect(coreVoting, signer);

  const rawdata = fs.readFileSync("scripts/egp39/proposalInfo.json");
  const proposalInfo: ProposalInfo = JSON.parse(rawdata.toString());
  const { proposalId, targets, callDatas } = proposalInfo;

  console.log("executing proposal");
  try {
    await coreVotingContract.execute(proposalId, targets, callDatas);
  } catch (err: any) {
    console.log("proposalId", proposalId, "failed");
    console.log("err", err.reason);
  }
}
