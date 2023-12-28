import { Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import hre from "hardhat";

import grants from "src/grants";

import addressesJson from "./addresses";
import { consoleGrants } from "./helpers/consoleGrants";
import { fetchGrantsByAddress } from "./helpers/fetchGrantAddresses";
import { logGrants } from "./helpers/logGrants";

const { PRIVATE_KEY, USE_TEST_SIGNER } = process.env;
const { provider } = hre.ethers;

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
  if (!PRIVATE_KEY) {
    return;
  }

  const { vestingVault } = addressesJson.addresses;
  const granteeAddresses = grants.grantUpdatesForEGP27.map((g) => g.who);

  let signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);
  if (USE_TEST_SIGNER) {
    console.log("******************************************");
    console.log("USING TEST SIGNER ", signer.address);
    console.log("******************************************");
    // sisyphus.eth
    signer = (await hre.ethers.getImpersonatedSigner(
      "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
    )) as unknown as Wallet;
    // give some eth
    await hre.network.provider.send("hardhat_setBalance", [
      signer.address,
      parseEther("1000").toHexString().replace("0x0", "0x"),
    ]);
  } else {
    console.log("******************************************");
    console.log("USING SIGNER ", signer.address);
    console.log("******************************************");
  }

  // log all the grants
  const fetchedGrants = await fetchGrantsByAddress(vestingVault, signer);
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  console.log("logging all grants");
  logGrants(fetchedGrants, `grants${blockNumber}.csv`);
  // console the grants in grants.ts
  consoleGrants(
    Object.fromEntries(
      Object.entries(fetchedGrants).filter(([address]) =>
        granteeAddresses.includes(address)
      )
    )
  );
}
