import { Signer } from "ethers";
import { CoreVoting__factory, Timelock__factory } from "typechain";

import addressesJson from "./addresses";

export async function executeVestingProposal(
  signer: Signer,
  proposalId: string,
  targets: string[],
  callDatas: string[]
) {
  const { coreVoting } = addressesJson.addresses;
  const coreVotingContract = CoreVoting__factory.connect(coreVoting, signer);
  const result = await coreVotingContract.execute(
    proposalId,
    targets,
    callDatas
  );
  const txReceipt = await result.wait(1);
  return txReceipt;
}

export async function executeVestingProposalTimelock(
  signer: Signer,
  targets: string[],
  callDatas: string[]
) {
  const { timeLock } = addressesJson.addresses;
  const timeLockContract = Timelock__factory.connect(timeLock, signer);
  await timeLockContract.execute(targets, callDatas);
}
