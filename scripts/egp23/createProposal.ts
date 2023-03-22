import { Wallet } from "ethers";
import fs from "fs";
import hre from "hardhat";

import addressesJson from "src/addresses";
import { createUpdateTimeStampsProposal } from "src/createProposalUpdateTimeStamps";
import { fetchGrantsByAddress } from "src/helpers/fetchGrantAddresses";
import { logGrants } from "src/helpers/logGrants";

const { PRIVATE_KEY, NUM_DAYS_TO_EXECUTE, USE_TEST_SIGNER } = process.env;

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

  const { vestingVault, lockingVault, unfrozenVestingVaultAddress } =
    addressesJson.addresses;

  let signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);
  if (USE_TEST_SIGNER) {
    // sisyphus.eth
    signer = (await hre.ethers.getImpersonatedSigner(
      "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
    )) as unknown as Wallet;
  }

  // log all the grants
  console.log("logging all grants");
  const grantsBeforeProposal = await fetchGrantsByAddress(vestingVault, signer);
  logGrants(
    grantsBeforeProposal,
    "scripts/egp23/grantsBeforeUpdateTimeStamps.csv"
  );

  //*************************************************//
  // create the proposoal
  //*************************************************//
  console.log("creating the proposal");
  const votingVaultAddresses = [lockingVault];
  const extraVaultDatas = ["0x00"];

  // create propopsal
  const proposalInfo = await createUpdateTimeStampsProposal(
    signer,
    grantsBeforeProposal,
    unfrozenVestingVaultAddress,
    votingVaultAddresses,
    extraVaultDatas
  );
  const data = JSON.stringify(proposalInfo, null, 2);
  fs.writeFileSync("scripts/egp23/proposalInfo.json", data);
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
