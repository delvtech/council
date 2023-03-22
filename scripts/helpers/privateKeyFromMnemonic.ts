import { ethers } from "ethers";

async function main() {
  const mnemonic =
    "test test test test test test test test test test test test";
  const mnemonicWallet = ethers.Wallet.fromMnemonic(mnemonic);
  console.log("mnemonicWallet", mnemonicWallet.privateKey);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
