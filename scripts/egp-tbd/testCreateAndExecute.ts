// # Script to update grants with new values
import { createUpgradeGrantsProposal } from "./createProposal";
import { main as setQuorum } from "scripts/helpers/setQuorum";
import { main as jumpForward } from "scripts/helpers/jumpForward";
import { main as readUnassignedTokens } from "src/readUnassignedTokens";
import { main as getGrants } from "src/getGrants";
import { main as previewProposal } from "./previewProposal";
import { main as executeProposal } from "./executeProposal";

// # get the proposal arguments, preview the proposal
// npx hardhat run scripts/egp-tbd/previewProposal.ts --no-compile --network $NETWORK

// # sets quorum low so we can pass it when we create it
// npx hardhat run scripts/helpers/setQuorum.ts --no-compile --network $NETWORK

// # create the actual proposal
// npx hardhat run scripts/egp-tbd/createProposal.ts --no-compile --network $NETWORK

// # jump forward in time so we can execute the proposal
// npx hardhat run scripts/helpers/jumpForward.ts --no-compile --network $NETWORK

// # executing the proposal
// npx hardhat run scripts/egp-tbd/executeProposal.ts --no-compile --network $NETWORK

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
