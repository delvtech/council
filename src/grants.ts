import { parseEther } from "ethers/lib/utils";
import { Grant } from "./types";

const grantsExample: Grant[] = [
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

const grants: Grant[] = [
  // 0x561C1693fD7c874763f99D0F456C0D2353c85e26	500,000	219178.08
  {
    method: "reduceGrant",
    who: "0x561C1693fD7c874763f99D0F456C0D2353c85e26",
    amount: parseEther(String("219178.08")).toString(),
  },
  // 0x7C9C99a9c0BB31c054de1bD9aF546Db10E35785B	200,000	72328.77
  {
    method: "reduceGrant",
    who: "0x7C9C99a9c0BB31c054de1bD9aF546Db10E35785B",
    amount: parseEther(String("72328.77")).toString(),
  },
  // 0x3a543655E484D9ad9ADA138170254f5880b695cE	125,000	0
  {
    method: "reduceGrant",
    who: "0x3a543655E484D9ad9ADA138170254f5880b695cE",
    amount: "0",
  },
  // 0x9814CA52E5235e9Ea7709475893645BeD9a9CF43	75,000	0
  {
    method: "reduceGrant",
    who: "0x9814CA52E5235e9Ea7709475893645BeD9a9CF43",
    amount: "0",
  },
  // 0xb603613b9e3f76Ab26CE2a259f1Db8ea5E9dc595	75,000	0
  {
    method: "reduceGrant",
    who: "0xb603613b9e3f76Ab26CE2a259f1Db8ea5E9dc595",
    amount: "0",
  },
  // 0x46Aa35190959c7a639ada37a99068b6740a0a5ED	150,000	0
  {
    method: "reduceGrant",
    who: "0x46Aa35190959c7a639ada37a99068b6740a0a5ED",
    amount: "0",
  },
  // 0x08627fcB1Edd7006b9f71FBd5b0eC91b4D8dd50A	35,000	0
  {
    method: "reduceGrant",
    who: "0x08627fcB1Edd7006b9f71FBd5b0eC91b4D8dd50A",
    amount: "0",
  },
  // 0x2592998309c9a89d9EAaf7Cf7cFa94DB8ba87703	75,000	0
  {
    method: "reduceGrant",
    who: "0x2592998309c9a89d9EAaf7Cf7cFa94DB8ba87703",
    amount: "0",
  },
  // 0xB0Ad0EEA2061d1B699E6c0d353FDEE59f40262bb	750,000	477397.26
  {
    method: "reduceGrant",
    who: "0xB0Ad0EEA2061d1B699E6c0d353FDEE59f40262bb",
    amount: parseEther(String("477397.26")).toString(),
  },
  // 0xCf0fB739fB119B4E41E872A2A1223832900f0361	200,000	92054.79
  {
    method: "reduceGrant",
    who: "0xCf0fB739fB119B4E41E872A2A1223832900f0361",
    amount: parseEther(String("92054.79")).toString(),
  },
];

export default grants;
