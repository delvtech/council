// # Script to update grants with new values
import { createUpgradeGrantsProposal } from "./createProposal";
import { main as setQuorum } from "scripts/helpers/setQuorum";
import { main as jumpForward } from "scripts/helpers/jumpForward";
import { main as readUnassignedTokens } from "src/readUnassignedTokens";
import { main as getGrants } from "src/getGrants";
import { main as executeProposal } from "./executeProposal";

async function main() {
  // console.log("previewProposal");
  // await previewProposal();
  console.log("setQuorum");
  await setQuorum();
  console.log("createUpgradeGrantsProposal");
  await createUpgradeGrantsProposal();
  console.log("jumpForward");
  await jumpForward();
  console.log("executeProposal");
  await executeProposal();
  console.log("readUnassignedTokens");
  await readUnassignedTokens();
  console.log("getGrants");
  await getGrants();
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
