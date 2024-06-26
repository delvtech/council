import hre from "hardhat";
import { Wallet } from "ethers";

const { provider } = hre.ethers;
const { PRIVATE_KEY, USE_TEST_SIGNER } = process.env;

export async function getSigner(): Promise<Wallet | undefined> {
  if (!PRIVATE_KEY) {
    console.log("ERROR: PRIVATE_KEY is not set");
    return;
  }

  let signer = new hre.ethers.Wallet(PRIVATE_KEY, provider);
  if (USE_TEST_SIGNER) {
    // sisyphus.eth
    signer = (await hre.ethers.getImpersonatedSigner(
      "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
    )) as unknown as Wallet;
    console.log("\n******************************************");
    console.log("USING TEST SIGNER ", signer.address);
    console.log("******************************************\n");
  } else {
    console.log("\n******************************************");
    console.log("USING SIGNER ", signer.address);
    console.log("******************************************\n");
  }
  return signer;
}
