import hre from "hardhat";

import addressesJson from "src/addresses";

const { provider } = hre.ethers;

export async function main() {
  const { coreVoting } = addressesJson.addresses;

  // set quourm to 1 so we can pass the proposal
  const quorumSlot = "0x3";
  const value = hre.ethers.utils.hexlify(hre.ethers.utils.zeroPad("0x01", 32)); // 100k quorum
  await provider.send("hardhat_setStorageAt", [coreVoting, quorumSlot, value]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
