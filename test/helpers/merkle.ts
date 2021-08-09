import { MerkleTree } from "merkletreejs";
import { BigNumberish } from "@ethersproject/contracts/node_modules/@ethersproject/bignumber";
import { ethers } from "ethers";
import { keccak256 } from "keccak256";

export interface Account {
  address: string;
  value: BigNumberish;
}

export async function getMerkleTree(accounts: Account[]) {
  const leaves = await Promise.all(
    accounts.map((account) => hashAccount(account))
  );
  console.log(leaves);
  return new MerkleTree(leaves, keccak256, {
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
