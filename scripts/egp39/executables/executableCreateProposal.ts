import hre from "hardhat";
// # Script to update grants with new values
import { createProposal } from "../createProposal";
import { sleep } from "src/helpers/sleep";
import { getSigner } from "scripts/helpers/getSigner";

async function main() {
  const signer = await getSigner();

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
