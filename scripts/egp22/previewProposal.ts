import fs from "fs";
import hre from "hardhat";

import addressesJson from "src/addresses";
import { getUpdateGrantsProposalArgs } from "src/createProposalUpdateGrants";
import grants from "src/grants";

const { PRIVATE_KEY } = process.env;
const { provider } = hre.ethers;

//*************************************************//
// Returns the arguments needed to create an upgrade
// grants proposal.
//*************************************************//

export async function main() {
  if (!PRIVATE_KEY) {
    return;
  }

  const {
    timeLock,
    vestingVault,
    frozenVestingVaultAddress,
    unfrozenVestingVaultAddress,
  } = addressesJson.addresses;

  const { grantUpdatesForEGP22 } = grants;

  console.log("getting the proposal arguments");

  const proposalArgs = await getUpdateGrantsProposalArgs(
    provider,
    grantUpdatesForEGP22,
    unfrozenVestingVaultAddress,
    frozenVestingVaultAddress,
    vestingVault,
    timeLock
  );

  console.log("proposalArgs", proposalArgs);
  const data = JSON.stringify(proposalArgs, null, 2);
  fs.writeFileSync("scripts/egp22/proposalArgs.json", data);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
