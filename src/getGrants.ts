import { parseEther } from "ethers/lib/utils";
import hre from "hardhat";

import grants from "src/grants";

import addressesJson from "./addresses";
import { consoleGrants } from "./helpers/consoleGrants";
import { fetchGrantsByAddress } from "./helpers/fetchGrantAddresses";
import { logGrants } from "./helpers/logGrants";

/**
 *  Performs a mainnet fork test to update grants in the vesting vault.  This is a full runthrough
 *  that performs the following:
 *     Deploys a new UnfrozenVestingVault with ability to reduce/remove grants
 *     Takes a list of grant modifications in src/testGrants.ts and creates a proposal
 *     Submits the proposal to the CoreVoting contract
 *     Jumps in time and then executes that proposal
 *     Jumps in time again and then executes the proposal from the Timelock contract
 *
 *  In addition, the full list of grants are fetched and logged before and after the proposal so we
 *  can look at a diff of the grants.
 */
export async function main() {
  const { vestingVault } = addressesJson.addresses;

  const granteeAddresses = grants.grantUpdatesForEGP22.map((g) => g.who);

  // sisyphus.eth
  const signer = await hre.ethers.getImpersonatedSigner(
    "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
  );

  // give some eth
  await hre.network.provider.send("hardhat_setBalance", [
    signer.address,
    parseEther("1000").toHexString().replace("0x0", "0x"),
  ]);

  // log all the grants
  const grantsBeforeProposal = await fetchGrantsByAddress(vestingVault, signer);
  console.log("logging all grants");
  logGrants(grantsBeforeProposal, "grantsBeforeAddRemove.csv");
  // console the grants in grants.ts
  consoleGrants(
    Object.fromEntries(
      Object.entries(grantsBeforeProposal).filter(([address]) =>
        granteeAddresses.includes(address)
      )
    )
  );
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
