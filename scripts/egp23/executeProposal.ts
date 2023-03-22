import { fs } from "fs";
import hre from "hardhat";
import { CoreVoting__factory } from "typechain";

import addressesJson from "src/addresses";
import { ProposalInfo } from "src/types";

const { PRIVATE_KEY, NUM_DAYS_TO_EXECUTE } = process.env;

const { provider } = hre.ethers;

/**
 *     Takes a list of grant modifications in src/testGrants.ts and creates a proposal
 *     Submits the proposal to the CoreVoting contract
 *     In addition, the full list of grants are fetched and logged before and after the proposal so we
 *     can look at a diff of the grants.
 */
async function main() {
  if (!PRIVATE_KEY || !NUM_DAYS_TO_EXECUTE) {
    return;
  }

  const { coreVoting } = addressesJson.addresses;

  const signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);

  //*************************************************//
  // execute the proposoal
  //*************************************************//
  console.log("execute proposal");
  const rawdata = fs.readFileSync("scripts/egp22/proposalInfo.json");
  const proposalInfo: ProposalInfo = JSON.parse(rawdata.toString());
  const { proposalId, targets, callDatas } = proposalInfo;
  const coreVotingContract = CoreVoting__factory.connect(coreVoting, signer);

  const result = await coreVotingContract.execute(
    proposalId,
    targets,
    callDatas
  );
  await result.wait(1);
  console.log("executed proposal");
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
