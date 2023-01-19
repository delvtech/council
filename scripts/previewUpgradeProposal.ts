import hre from "hardhat";
import fs from "fs";

import { getUpdateGrantsProposalArgs } from "src/createProposalUpdateGrants";

import addressesJson from "../src/addresses";
import grants from "../src/grants";

const { PRIVATE_KEY } = process.env;

//*************************************************//
// Returns the arguments needed to create an upgrade
// grants proposal.
//*************************************************//

async function main() {
  if (!PRIVATE_KEY) {
    return;
  }

  const {
    timeLock,
    vestingVault,
    frozenVestingVaultAddress,
    unfrozenVestingVaultAddress,
  } = addressesJson.addresses;

  const provider = hre.ethers.getDefaultProvider();

  console.log("creating the proposal");

  const proposalArgs = await getUpdateGrantsProposalArgs(
    provider,
    grants,
    frozenVestingVaultAddress,
    unfrozenVestingVaultAddress,
    vestingVault,
    timeLock
  );

  console.log("proposalArgs", proposalArgs);
  const data = JSON.stringify(proposalArgs);
  fs.writeFileSync("proposalArgs.json", data);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
