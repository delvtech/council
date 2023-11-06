import hre from "hardhat";
import { CoreVoting__factory } from "typechain";

import addressesJson from "src/addresses";

const RPC_HOST = "http://127.0.0.1:8545";
const provider = new hre.ethers.providers.JsonRpcProvider(RPC_HOST);

export async function main() {
  const { coreVoting } = addressesJson.addresses;

  const coreVotingContract = CoreVoting__factory.connect(coreVoting, provider);

  const lockDuration = await coreVotingContract.lockDuration();
  const lockDurationHexString = lockDuration.toHexString().replace("0x0", "0x");
  await hre.network.provider.send("hardhat_mine", [lockDurationHexString]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
