import { Wallet } from "ethers";
import fs from "fs";
import hre from "hardhat";
import { CoreVoting__factory, Timelock__factory } from "typechain";

import addressesJson from "src/addresses";
import { ProposalInfo } from "src/types";
import { fetchGrantsByAddress } from "src/helpers/fetchGrantAddresses";
import { logGrants } from "src/helpers/logGrants";
import { consoleGrants } from "src/helpers/consoleGrants";
import grants from "src/grants";
import { sleep } from "src/helpers/sleep";

const { PRIVATE_KEY, USE_TEST_SIGNER } = process.env;
const { provider } = hre.ethers;

/**
 * Creates the upgrade grants proposal
 */
export async function main() {
  // [signer] = await hre.ethers.getSigners();
  if (!PRIVATE_KEY) {
    return;
  }

  let signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);
  if (USE_TEST_SIGNER) {
    console.log("******************************************");
    console.log("USING TEST SIGNER ", signer.address);
    console.log("******************************************");
    // sisyphus.eth
    signer = (await hre.ethers.getImpersonatedSigner(
      "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
    )) as unknown as Wallet;
  } else {
    console.log("******************************************");
    console.log("USING SIGNER ", signer.address);
    console.log("******************************************");
  }
  await sleep(10_000);

  const { vestingVault, timeLock } = addressesJson.addresses;
  const timelockContract = Timelock__factory.connect(timeLock, signer);

  const rawdata = fs.readFileSync("scripts/egp27/proposalInfo.json");
  const proposalInfo: ProposalInfo = JSON.parse(rawdata.toString());
  const { proposalId, targetsTimeLock, calldatasTimeLock } = proposalInfo;

  console.log("executing timelock proposal");
  try {
    await timelockContract.execute(targetsTimeLock, calldatasTimeLock);
  } catch (err: any) {
    console.log("proposalId", proposalId, "failed");
    console.log("err", err.reason);
  }

  const granteeAddresses = grants.grantUpdatesForEGP27.map((g) => g.who);

  const grantsAfterProposal = await fetchGrantsByAddress(vestingVault, signer);
  console.log("logging all grants");
  logGrants(grantsAfterProposal, "grantsAfterEGP27.csv");
  // console the grants in grants.ts
  consoleGrants(
    Object.fromEntries(
      Object.entries(grantsAfterProposal).filter(([address]) =>
        granteeAddresses.includes(address)
      )
    )
  );
}
