import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import fs from "fs";
import hre from "hardhat";
import { CoreVoting__factory } from "typechain";

import addressesJson from "src/addresses";
import { ProposalInfo } from "src/types";

const { PRIVATE_KEY, NUM_DAYS_TO_EXECUTE, USE_TEST_SIGNER } = process.env;
const { provider } = hre.ethers;

/**
 * Creates the upgrade grants proposal
 */
async function main() {
  if (!PRIVATE_KEY || !NUM_DAYS_TO_EXECUTE) {
    return;
  }

  let signer = new hre.ethers.Wallet(
    PRIVATE_KEY,
    provider
  ) as unknown as SignerWithAddress;
  if (USE_TEST_SIGNER) {
    console.log("USE_TEST_SIGNER", USE_TEST_SIGNER);
    // sisyphus.eth
    signer = await hre.ethers.getImpersonatedSigner(
      "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
    );
    [signer] = await hre.ethers.getSigners();
  }

  const { coreVoting } = addressesJson.addresses;
  const coreVotingContract = CoreVoting__factory.connect(coreVoting, signer);

  const rawdata = fs.readFileSync("scripts/egp22/proposalInfo.json");
  const proposalInfo: ProposalInfo = JSON.parse(rawdata.toString());
  const { proposalId, targets, callDatas } = proposalInfo;

  console.log("executing proposal");
  try {
    return await coreVotingContract.execute(proposalId, targets, callDatas);
  } catch (err: any) {
    console.log("proposalId", proposalId, "failed");
    console.log("err", err.reason);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
