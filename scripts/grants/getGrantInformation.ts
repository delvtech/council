// import fs from "fs";
import { formatEther } from "ethers/lib/utils";
import hre from "hardhat";

import addressesJson from "src/addresses";
import { VestingVault__factory } from "typechain";
import { VestingVaultStorage } from "typechain/contracts/mocks/TestVestingVault";

const { provider } = hre.ethers;

//*************************************************//
// Gets information about grants.
//*************************************************//

async function main() {
  console.log("Getting grant info.");

  const { vestingVault: vestingVaultAddress } = addressesJson.addresses;

  console.log("getting the proposal arguments");

  // create the arguments to coreVoting.proposal()
  const vestingVault = VestingVault__factory.connect(
    vestingVaultAddress,
    provider
  );

  interface GrantInfo {
    address: string;
    terminationDate: string;
    name: string;
  }
  const grantInfos: GrantInfo[] = [
    {
      address: "0xFB18b8F2bBE88c4C29ca5a12ee404DB4d640fe4E",
      terminationDate: "4/10/2023",
      name: "Patrick Morris",
    },
    {
      address: "0x4103672489e420076B012Dda2Ba2B0c414d985ca",
      terminationDate: "6/30/2023",
      name: "Violet Vienhage",
    },
    {
      address: "0xfb0e31B422E606Ca996E4415243EBF15c2E5535E",
      terminationDate: "5/22/2023",
      name: "Cash DeLeon",
    },
    {
      address: "0x84ad922d23A7613e0d25F36CB65CD5F92a155110",
      terminationDate: "6/15/2023",
      name: "Will Villanueva",
    },
  ];

  const grantPromises = grantInfos.map(
    async ({ address }) => await vestingVault.getGrant(address)
  );

  const grantOutputs: VestingVaultStorage.GrantStructOutput[] =
    await Promise.all(grantPromises);

  const createdDateString = "4/1/2022";
  const expirationDateString = "4/3/2025";
  const createdEpochSeconds =
    convertDateStringToEpochSeconds(createdDateString);
  const expirationEpochSeconds =
    convertDateStringToEpochSeconds(expirationDateString);
  const grants = grantOutputs.map(
    (
      {
        allocation,
        withdrawn,
        created,
        expiration,
        cliff,
        latestVotingPower,
        delegatee,
        range,
      },
      index
    ) => {
      const grantInfo = grantInfos[index];
      const terminationEpochSeconds = convertDateStringToEpochSeconds(
        grantInfo.terminationDate
      );

      const vestedAmount =
        (Number(formatEther(allocation)) *
          (terminationEpochSeconds - createdEpochSeconds)) /
        (expirationEpochSeconds - createdEpochSeconds);

      return {
        address: grantInfo.address,
        name: grantInfo.name,
        startDate: "4/1/2022",
        terminationDate: grantInfo.terminationDate,
        vestedAmount,
        allocation: formatEther(allocation),
        vestedPercent:
          Math.round(
            (100 * (100 * vestedAmount)) / Number(formatEther(allocation))
          ) / 100,
        // withdrawn: formatEther(withdrawn),
        // created: created.toNumber(),
        // expiration: expiration.toNumber(),
        // cliff: cliff.toNumber(),
        // latestVotingPower: latestVotingPower.toString(),
        // delegatee: delegatee,
        // range: range.map((value) => value.toString()),
      };
    }
  );

  console.log("grants", grants);

  // fs.writeFileSync("scripts/grants/grants.json", grants);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function convertDateStringToEpochSeconds(dateString: string) {
  const dateObject = new Date(dateString);
  const epochSeconds = Math.floor(dateObject.getTime() / 1000);
  return epochSeconds;
}
