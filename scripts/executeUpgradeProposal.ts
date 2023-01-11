import fs from "fs";
import hre from "hardhat";
import { CoreVoting__factory } from "typechain";

import addressesJson from "../src/addresses";
import { ProposalInfo } from "src/types";

const { PRIVATE_KEY, NUM_DAYS_TO_EXECUTE } = process.env;
const RPC_HOST = "http://127.0.0.1:8545";

const provider = new hre.ethers.providers.JsonRpcProvider(RPC_HOST);

/**
 * Creates the upgrade grants proposal
 */
async function main() {
  if (!PRIVATE_KEY || !NUM_DAYS_TO_EXECUTE) {
    return;
  }

  const signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);

  const { coreVoting } = addressesJson.addresses;
  const coreVotingContract = CoreVoting__factory.connect(coreVoting, signer);

  const rawdata = fs.readFileSync("proposalInfo.json");
  const proposalInfo: ProposalInfo = JSON.parse(rawdata.toString());
  const { proposalId, targets, callDatas } = proposalInfo;

  const result = await coreVotingContract.execute(
    proposalId,
    targets,
    callDatas
  );
  console.log("result", result);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
