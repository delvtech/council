import hre from "hardhat";

import { deployVaultUpgrade } from "src/deployVaultUpgrade";

const { PRIVATE_KEY } = process.env;
const { provider } = hre.ethers;

//*************************************************//
// deploy the unfrozen vesting vault
//*************************************************//
async function main() {
  if (!PRIVATE_KEY) {
    return;
  }

  const signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);
  await deployVaultUpgrade(signer);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
