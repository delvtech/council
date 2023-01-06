import { SECONDS_PER_BLOCK } from "./constants";
import { VestingVaultStorage } from "typechain/contracts/vaults/VestingVault.sol/AbstractVestingVault";
import { Provider } from "@ethersproject/providers";
import timelockInterface from "artifacts/contracts/features/Timelock.sol/Timelock.json";
import vaultInterface from "artifacts/contracts/vaults/UnfrozenVestingVault.sol/UnfrozenVestingVault.json";
import { ethers, Signer } from "ethers";
import hre from "hardhat";
import { CoreVoting__factory, SimpleProxy__factory } from "typechain";

import addressesJson from "src/addresses";
import { DAY_IN_BLOCKS } from "src/constants";
import { createCallHash } from "src/helpers/createCallHash";
import { AddGrant, Grant, ProposalInfo, ReduceGrant } from "src/types";

export async function createProposalUpdateGrants(
  signer: Signer,
  grants: Grant[],
  unfrozenVaultAddress: string,
  votingVaultAddresses: string[],
  extraVaultDatas: string[]
): Promise<ProposalInfo> {
  const provider = hre.ethers.getDefaultProvider();

  //*************************************************//
  // create the proposoal
  //*************************************************//
  const { coreVoting, timeLock, vestingVault } = addressesJson.addresses;
  const vestingVaultProxy = SimpleProxy__factory.connect(vestingVault, signer);
  const frozenVaultAddress = await vestingVaultProxy.proxyImplementation();

  const proposalInfo = await createVestingGrantsUpgradeProposal(
    signer,
    provider,
    coreVoting,
    timeLock,
    vestingVault,
    unfrozenVaultAddress,
    frozenVaultAddress,
    votingVaultAddresses,
    extraVaultDatas,
    grants
  );

  return proposalInfo;
}

export async function createVestingGrantsUpgradeProposal(
  signer: Signer,
  provider: Provider,
  coreVotingAddress: string,
  timeLockAddress: string,
  // vesting vault proxy address
  vestingVaultAddress: string,
  // upgraded vesting vault implementation address
  unfrozenVaultAddress: string,
  // original vesting vault implementation address
  frozenVaultAddress: string,
  // voting vaults to query vote power from to submit proposal
  votingVaultAddresses: string[],
  // extra data for voting vaults if necessary
  extraVaultData: string[],
  // grants to add/remove
  grants: Grant[]
): Promise<ProposalInfo> {
  /********************************************************************************
   * Set up a new proposal.  This proposal will perform 3 actions:
   *   1. temporarily upgrade the VestingVault's implementation to one that can add AND remove grants
   *   2. perform necessary updates to grants
   *   3. reset the VestingVault back to the original implementation.
   ********************************************************************************/

  // step 1 is to update the vesting vault implementation address
  const proxyInterface = new ethers.utils.Interface(SimpleProxy__factory.abi);
  const calldataProxyUpgrade = proxyInterface.encodeFunctionData(
    "upgradeProxy",
    [unfrozenVaultAddress]
  );

  // step 2 is to add/remove a bunch of grants
  const vestingVaultInterface = new ethers.utils.Interface(vaultInterface.abi);
  const callDatasUpdateGrant: string[] = [];

  for (let i = 0; i < grants.length; i++) {
    const grant = grants[i];
    const { method } = grant;
    if (isAddGrant(grant)) {
      const {
        who,
        amount,
        startBlock,
        expirationInDays = 0,
        cliffEndsInDays = 0,
        delegatee,
      } = grant as AddGrant;

      const currentBlock = await provider.getBlockNumber();
      const startingBlock = startBlock ?? currentBlock + 10;
      const expiration =
        startingBlock + Math.round(DAY_IN_BLOCKS * expirationInDays);
      const cliff = startingBlock + Math.round(DAY_IN_BLOCKS * cliffEndsInDays);

      const values = [who, amount, startingBlock, expiration, cliff, delegatee];
      const calldata = vestingVaultInterface.encodeFunctionData(method, values);
      callDatasUpdateGrant.push(calldata);
    }

    if (isReduceGrant(grant)) {
      const { who, amount } = grant;
      const values = [who, amount];
      const calldata = vestingVaultInterface.encodeFunctionData(method, values);
      callDatasUpdateGrant.push(calldata);
    }
  }

  // step 3 is to reset the vesting vault implementation address
  const calldataProxyDowngrade = proxyInterface.encodeFunctionData(
    "upgradeProxy",
    [frozenVaultAddress]
  );

  const calldatasTimeLock = [
    calldataProxyUpgrade,
    ...callDatasUpdateGrant,
    calldataProxyDowngrade,
  ];

  // we are only hitting the vesting vault's proxy address
  const targetsTimeLock = calldatasTimeLock.map(() => vestingVaultAddress);
  const callHashTimelock = await createCallHash(
    calldatasTimeLock,
    targetsTimeLock
  );

  // create the arguments to coreVoting.proposal()
  const coreVotingContract = CoreVoting__factory.connect(
    coreVotingAddress,
    signer
  );
  const tInterface = new ethers.utils.Interface(timelockInterface.abi);
  const calldataCoreVoting = tInterface.encodeFunctionData("registerCall", [
    callHashTimelock,
  ]);

  const targets = [timeLockAddress];
  const callDatas = [calldataCoreVoting];
  const currentBlock = await provider.getBlockNumber();
  const proposalHash = createCallHash(callDatas, targets);
  // last chance to execute to vote is ~14 days from current block
  const lastCall = Math.round(DAY_IN_BLOCKS * 14 + currentBlock);

  const ballot = 0; // 0 - YES, 1 - NO, 2 - ABSTAIN
  const tx = await coreVotingContract.proposal(
    votingVaultAddresses,
    extraVaultData,
    targets,
    callDatas,
    lastCall,
    ballot
  );
  await tx.wait(1);

  // just getting the proposalId
  const proposalCreatedEvents = await coreVotingContract.queryFilter(
    coreVotingContract.filters.ProposalCreated(),
    currentBlock
  );
  const proposalId = proposalCreatedEvents[0].args[0].toNumber();

  const proposalArgs = [
    ["proposalId", proposalId],
    ["votingVaults", votingVaultAddresses],
    ["extraVaultData", extraVaultData],
    ["targets", targets],
    ["callDatas", callDatas],
    ["proposalHash", proposalHash],
    ["targetsTimeLock", targetsTimeLock],
    ["calldatasTimeLock", calldatasTimeLock],
    ["callHashTimelock", callHashTimelock],
    ["lastCall", lastCall],
    ["ballot", ballot],
  ];

  console.log("Proposal created with:");
  proposalArgs.forEach(([name, value]) => console.log(name, value));

  const proposalInfo: ProposalInfo = Object.fromEntries(proposalArgs);
  return proposalInfo;
}

function isAddGrant(grant: Grant): grant is AddGrant {
  return grant.method === "addGrantAndDelegate";
}

function isReduceGrant(grant: Grant): grant is ReduceGrant {
  return grant.method === "reduceGrant";
}
