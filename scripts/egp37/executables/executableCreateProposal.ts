import hre from "hardhat";
import { Wallet } from "ethers";
// # Script to update grants with new values
import { createProposal } from "../createProposal";
import { sleep } from "src/helpers/sleep";

const { USE_TEST_SIGNER, PRIVATE_KEY } = process.env;

async function main() {
  const { provider } = hre.ethers;

  if (!PRIVATE_KEY) {
    console.log("NO PRIVATE KEY, EXITING");
    return;
  }
  let signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);

  if (USE_TEST_SIGNER === "true") {
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
  await createProposal(signer);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log("error");
    console.error(error);
    process.exit(1);
  });
