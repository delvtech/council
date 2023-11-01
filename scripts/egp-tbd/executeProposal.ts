import fs from "fs";
import hre from "hardhat";
import { CoreVoting__factory, Timelock__factory } from "typechain";

import addressesJson from "src/addresses";
import { ProposalInfo } from "src/types";
import { fetchGrantsByAddress } from "src/helpers/fetchGrantAddresses";
import { logGrants } from "src/helpers/logGrants";
import { consoleGrants } from "src/helpers/consoleGrants";
import grantUpdatesForEGP22 from "src/grants";

const { USE_TEST_SIGNER } = process.env;

/**
 * Creates the upgrade grants proposal
 */
async function main() {
  console.log("USE_TEST_SIGNER", USE_TEST_SIGNER);
  // sisyphus.eth
  const signer = await hre.ethers.getImpersonatedSigner(
    "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
  );
  // [signer] = await hre.ethers.getSigners();

  const { coreVoting, vestingVault, timeLock } = addressesJson.addresses;
  const coreVotingContract = CoreVoting__factory.connect(coreVoting, signer);
  const timelockContract = Timelock__factory.connect(timeLock, signer);

  const rawdata = fs.readFileSync("scripts/egp22/proposalInfo.json");
  const proposalInfo: ProposalInfo = JSON.parse(rawdata.toString());
  const { proposalId, targets, callDatas, targetsTimeLock, calldatasTimeLock } =
    proposalInfo;

  console.log("executing proposal");
  try {
    return await coreVotingContract.execute(proposalId, targets, callDatas);
  } catch (err: any) {
    console.log("proposalId", proposalId, "failed");
    console.log("err", err.reason);
  }

  console.log("executing timelock proposal");
  try {
    await timelockContract.execute(targetsTimeLock, calldatasTimeLock);
  } catch (err: any) {
    console.log("proposalId", proposalId, "failed");
    console.log("err", err.reason);
  }

  const granteeAddresses = grantUpdatesForEGP22.map((g) => g.who);

  const grantsBeforeProposal = await fetchGrantsByAddress(vestingVault, signer);
  console.log("logging all grants");
  logGrants(grantsBeforeProposal, "grantsAfterRemoveREAL.csv");
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
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
