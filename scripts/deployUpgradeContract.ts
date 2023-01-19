import hre from "hardhat";

import { deployVaultUpgrade } from "../src/deployVaultUpgrade";

const { PRIVATE_KEY } = process.env;
const RPC_HOST = "http://127.0.0.1:8545";
const provider = new hre.ethers.providers.JsonRpcProvider(RPC_HOST);

//*************************************************//
// deploy the unfrozen vesting vault
//*************************************************//
async function main() {
  if (!PRIVATE_KEY) {
    return;
  }

  const signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);

  console.log("deploying the upgraded vesting vault");
  const unfrozenVault = await deployVaultUpgrade(signer);
  console.log("vault address", unfrozenVault.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
