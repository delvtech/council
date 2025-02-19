import { Wallet } from "ethers";
import fs from "fs";
import { Timelock__factory } from "typechain";

import addressesJson from "src/addresses";
import { ProposalInfo } from "src/types";
import { getSigner } from "scripts/helpers/getSigner";

export async function executeTimelock(signer: Wallet | undefined) {
  signer = signer || (await getSigner());
  if (!signer) {
    return;
  }

  const { timeLock } = addressesJson.addresses;
  const timelockContract = Timelock__factory.connect(timeLock, signer);

  const rawdata = fs.readFileSync("scripts/egp39/proposalInfo.json");
  const proposalInfo: ProposalInfo = JSON.parse(rawdata.toString());
  const { proposalId, targetsTimeLock, calldatasTimeLock } = proposalInfo;

  console.log("executing timelock proposal");
  try {
    await timelockContract.execute(targetsTimeLock, calldatasTimeLock);
  } catch (err: any) {
    console.log("err", err);
    console.log("proposalId", proposalId, "failed");
    console.log("err", err.reason);
    return;
  }
}
