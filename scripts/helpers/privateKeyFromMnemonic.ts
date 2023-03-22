import { ethers } from "ethers";

async function main() {
  const mnemonic =
    "test test test test test test test test test test test test";
  const wallet = ethers.utils.HDNode.fromMnemonic(mnemonic);
  const wallet2 = wallet.derivePath("m/44'/60'/0'/0/1");
  console.log("wallet2 private key: ", wallet2.privateKey);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
