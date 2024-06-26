// # Script to update grants with new values
import hre from "hardhat";
import { main as setQuorum } from "scripts/helpers/setQuorum";
import { main as jumpForward } from "scripts/helpers/jumpForward";
import { previewProposal } from "./previewProposal";
import { executeProposal } from "./executeProposal";
import { executeTimelock } from "./executeTimelock";
import { createProposal } from "./createProposal";
import { getSigner } from "scripts/helpers/getSigner";

async function main() {
  const signer = await getSigner();

  await previewProposal();
  await setQuorum();
  await createProposal(signer);
  await jumpForward();
  await executeProposal(signer);
  await increaseTime(8 * 24 * 60 * 60);
  await executeTimelock(signer);
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

async function increaseTime(seconds: number) {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
}
