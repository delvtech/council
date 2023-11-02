import fs from "fs";
import hre from "hardhat";

import addressesJson from "src/addresses";
import { getUpdateGrantsProposalArgs } from "scripts/egp27/createProposalUpdateGrants";
import grants from "src/grants";

const { PRIVATE_KEY } = process.env;
const { provider } = hre.ethers;

//*************************************************//
// Returns the arguments needed to create an upgrade
// grants proposal.
//*************************************************//
export async function main() {
  if (!PRIVATE_KEY) {
    console.log("NO PRIVATE KEY, EXITING");
    return;
  }

  const {
    timeLock,
    vestingVault,
    frozenVestingVaultAddress,
    unfrozenVestingVaultAddress,
  } = addressesJson.addresses;

  const { grantUpdatesForEGP27 } = grants;

  console.log("getting the proposal arguments");

  const proposalArgs = await getUpdateGrantsProposalArgs(
    provider,
    grantUpdatesForEGP27,
    unfrozenVestingVaultAddress,
    frozenVestingVaultAddress,
    vestingVault,
    timeLock
  );

  console.log("proposalArgs", proposalArgs);
  const data = JSON.stringify(proposalArgs, null, 2);
  fs.writeFileSync("scripts/egp27/proposalArgs.json", data);
}
