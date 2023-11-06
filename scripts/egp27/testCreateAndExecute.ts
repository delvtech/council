// # Script to update grants with new values
import { createUpgradeGrantsProposal } from "./createProposal";
import { main as setQuorum } from "scripts/helpers/setQuorum";
import { main as jumpForward } from "scripts/helpers/jumpForward";
import { main as readUnassignedTokens } from "src/readUnassignedTokens";
import { main as getGrants } from "src/getGrants";
import { main as previewProposal } from "./previewProposal";
import { main as executeProposal } from "./executeProposalAndTimelock";

async function main() {
  await previewProposal();
  await setQuorum();
  await createUpgradeGrantsProposal();
  await jumpForward();
  await executeProposal();
  await readUnassignedTokens();
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
