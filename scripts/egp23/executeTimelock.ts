import { fs } from "fs";
import hre from "hardhat";
import { Timelock__factory } from "typechain";

import addressesJson from "src/addresses";
import { ProposalInfo } from "src/types";

const { PRIVATE_KEY, NUM_DAYS_TO_EXECUTE } = process.env;

const { provider } = hre.ethers;

/**
 *     Executes the proposal in the timelock
 */
async function main() {
  if (!PRIVATE_KEY || !NUM_DAYS_TO_EXECUTE) {
    return;
  }

  const { timeLock } = addressesJson.addresses;

  const signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);

  //*************************************************//
  // execute the proposoal in the timelock
  //*************************************************//
  console.log("executing timelocked proposal");
  const rawdata = fs.readFileSync("scripts/egp23/proposalInfo.json");
  const proposalInfo: ProposalInfo = JSON.parse(rawdata.toString());
  const { targetsTimeLock, calldatasTimeLock } = proposalInfo;

  const timeLockContract = Timelock__factory.connect(timeLock, signer);
  await timeLockContract.execute(targetsTimeLock, calldatasTimeLock);
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
