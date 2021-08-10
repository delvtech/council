import { MerkleTree } from "merkletreejs";
import { BigNumberish } from "@ethersproject/contracts/node_modules/@ethersproject/bignumber";
import { ethers } from "ethers";

export interface Account {
  address: string;
  value: BigNumberish;
}

export async function getMerkleTree(accounts: Account[]) {
  const leaves = await Promise.all(
    accounts.map((account) => hashAccount(account))
  );
  return new MerkleTree(leaves, keccak256Custom, {
    hashLeaves: false,
    sortPairs: true,
  });
}

export async function hashAccount(account: Account) {
  return ethers.utils.solidityKeccak256(
    ["address", "uint256"],
    [account.address, account.value]
  );
}

// Horrible hack because the keccak256 package as used by openzepplin in tests is failing on our
// system somehow
function keccak256Custom(bytes: Buffer) {
  const buffHash = ethers.utils.solidityKeccak256(
    ["bytes"],
    ["0x" + bytes.toString("hex")]
  );
  return Buffer.from(buffHash.slice(2), "hex");
}
