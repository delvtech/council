export type Grant = ReduceGrant | AddGrant;
export interface ReduceGrant {
  method: "reduceGrant";
  amount: string;
  // address of who gets grant
  who: string;
}

export interface AddGrant {
  method: "addGrantAndDelegate";
  // address of who gets grant
  who: string;
  // amount of the grant
  amount: string;
  // the block number to start the grant, 0 for current block
  startBlock: number;
  // number of days after the start block
  expirationInDays: number;
  // number of days until the grant starts vesting
  cliffEndsInDays: number;
  // who to initially delegate to
  delegatee: string;
}

export interface ProposalInfo {
  proposalId: string;
  votingVaults: string[];
  extraVaultData: string[];
  targets: string[];
  callDatas: string[];
  targetsTimeLock: string[];
  calldatasTimeLock: string[];
  lastCall: string;
  ballot: string;
}
