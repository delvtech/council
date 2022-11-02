import { parseEther } from "ethers/lib/utils";
import { Grant } from "./types";

const grants: Grant[] = [
  // remove a grant with a range
  {
    method: "reduceGrant",
    who: "0x22af075a70b9418d54e5c121419775fcd3842454", // had 700k tokens
    amount: "0", // now has 0 and grant deleted
  },
  // remove a grant without a range
  {
    method: "reduceGrant",
    who: "0xCf0fB739fB119B4E41E872A2A1223832900f0361", // had 200k tokens
    amount: "0", // now has 0 and grant deleted
  },
  // reduce a grant with a range
  {
    method: "reduceGrant",
    who: "0xb16c68F45bBD172341f20686203e829D4B80CD91", // had 700k tokens
    amount: parseEther(String(100_000)).toString(), // now has 100k
  },
  // reduce a grant without a range
  {
    method: "reduceGrant",
    who: "0x90e5aa59a9dF2ADd394df81521DbBEd5F3c4A1A3", // had 400k tokens
    amount: parseEther(String(200_000)).toString(), // now has 200k
  },
  // add a new grant
  {
    method: "addGrantAndDelegate",
    who: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // did not have a grant
    amount: parseEther(String(800_000)).toString(), // now has 100k
    startBlock: 0,
    expirationInDays: 365 * 3,
    cliffEndsInDays: 365,
    delegatee: "0x0000000000000000000000000000000000000001", // delegate to the ONE address
  },
];

export default grants;
