import { CoreVoting__factory } from "./../../typechain/factories/contracts/CoreVoting__factory";
import { ERC20PermitWithMint__factory } from "./../../typechain/factories/contracts/libraries/ERC20PermitWithMint__factory";
import fs from "fs";
import { ethers } from "hardhat";
import { ProposalArgs } from "src/types";

import addressesJson from "src/addresses";
import { Timelock__factory, Treasury__factory } from "typechain";
import { createCallHash } from "src/helpers/createCallHash";
import { getSigner } from "scripts/helpers/getSigner";
import { parseEther } from "ethers/lib/utils";

const { PRIVATE_KEY } = process.env;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const MAX_UINT_256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

const delvWalletAddress = "0xF6094C3A380AD6161Fb8240F3043392A0E427CAC";
const foundationWalletAddress = "0x0000000000000000000000000000000000000000";

//*************************************************//
// Returns arguments to transfer funds from the treasury to the delv wallet.
//*************************************************//
export async function previewProposal() {
  if (!PRIVATE_KEY) {
    console.log("NO PRIVATE KEY, EXITING");
    return;
  }

  const {
    elementToken,
    hdToken,
    coreVoting,
    lockingVault,
    vestingVault,
    gscCoreVoting,
    gscVault,
    hdLockingVault,
    hdMigrationLinearVestingVault,
    hdMigrationRewardsVault,
    hdGscVault,
    treasury,
    timeLock,
  } = addressesJson.addresses;

  console.log("getting the proposal arguments");

  const proposalArgs = await getProposalArgs(
    elementToken,
    hdToken,
    coreVoting,
    lockingVault,
    vestingVault,
    gscCoreVoting,
    gscVault,
    hdLockingVault,
    hdMigrationLinearVestingVault,
    hdMigrationRewardsVault,
    hdGscVault,
    treasury,
    timeLock
  );

  const data = JSON.stringify(proposalArgs, null, 2);
  fs.writeFileSync("scripts/egp39/proposalArgs.json", data);
}

export async function getProposalArgs(
  tokenAddress: string,
  hdTokenAddress: string,
  coreVotingAddress: string,
  lockingVaultAddress: string,
  vestingVaultAddress: string,
  gscCoreVotingAddress: string,
  gscVaultAddress: string,
  hdLockingVaultAddress: string,
  hdMigrationLinearVestingVaultAddress: string,
  hdMigrationRewardsVaultAddress: string,
  hdGscVaultAddress: string,
  treasuryAddress: string,
  timeLockAddress: string
): Promise<ProposalArgs> {
  // Actual proposal actions.
  const elfiTokenInterface = new ethers.utils.Interface(
    ERC20PermitWithMint__factory.abi
  );

  // Remove the LockingVault from the approved vault list in the CoreVoting contract.
  const coreVotingInterface = new ethers.utils.Interface(
    CoreVoting__factory.abi
  );
  const callDataChangeVaultStatusLockingVault =
    coreVotingInterface.encodeFunctionData("changeVaultStatus", [
      lockingVaultAddress,
      false,
    ]);

  // Remove the VestingVault from the approved vault list in the CoreVoting contract.
  const callDataChangeVaultStatusVestingVault =
    coreVotingInterface.encodeFunctionData("changeVaultStatus", [
      vestingVaultAddress,
      false,
    ]);

  // Remove the gscVotingVault from the approved vault list in the gscCoreVoting contract.
  const callDataChangeVaultStatusGscVault =
    coreVotingInterface.encodeFunctionData("changeVaultStatus", [
      gscVaultAddress,
      false,
    ]);

  // Add the hdLockingVault to the approved vault list in the CoreVoting contract.
  const callDataChangeVaultStatusHdLockingVault =
    coreVotingInterface.encodeFunctionData("changeVaultStatus", [
      hdLockingVaultAddress,
      true,
    ]);

  // Add the hdMigrationRewardsVault to the approved vault list in the CoreVoting contract.
  const callDataChangeVaultStatusHdMigrationRewardsVault =
    coreVotingInterface.encodeFunctionData("changeVaultStatus", [
      hdMigrationRewardsVaultAddress,
      true,
    ]);

  // Add the hdMigrationLinearVestingVault to the approved vault list in the CoreVoting contract.
  const callDataChangeVaultStatusHdMigrationLinearVestingVault =
    coreVotingInterface.encodeFunctionData("changeVaultStatus", [
      hdMigrationLinearVestingVaultAddress,
      true,
    ]);

  // Add the hdLockingVault to the approved vault list in the gscCoreVoting contract.
  const callDataChangeVaultStatusHdGscVault =
    coreVotingInterface.encodeFunctionData("changeVaultStatus", [
      hdGscVaultAddress,
      true,
    ]);

  // Set approvals for the hdLockingVault from the treasury for HD tokens.
  const treasuryInterface = new ethers.utils.Interface(Treasury__factory.abi);
  const callDataTreasuryApproveHdLockingVault =
    treasuryInterface.encodeFunctionData("approve", [
      hdTokenAddress,
      hdLockingVaultAddress,
      MAX_UINT_256,
    ]);
  const callDataTreasuryApproveHdMigrationRewardsVault =
    treasuryInterface.encodeFunctionData("approve", [
      hdTokenAddress,
      hdMigrationRewardsVaultAddress,
      MAX_UINT_256,
    ]);

  const callDataTreasuryApproveHdMigrationLinearVestingVault =
    treasuryInterface.encodeFunctionData("approve", [
      hdTokenAddress,
      hdMigrationLinearVestingVaultAddress,
      MAX_UINT_256,
    ]);
  const callDataTreasuryApproveHdGscVault =
    treasuryInterface.encodeFunctionData("approve", [
      hdTokenAddress,
      hdGscVaultAddress,
      MAX_UINT_256,
    ]);

  // Convert ELFI -> HD tokens for Delv, Foundation, Treasury
  const signer = await getSigner();
  if (!signer) {
    throw new Error("Signer not found");
  }
  const tokenContract = ERC20PermitWithMint__factory.connect(
    tokenAddress,
    signer
  );

  const delvBalance = await tokenContract.balanceOf(delvWalletAddress);
  const foundationBalance = await tokenContract.balanceOf(
    foundationWalletAddress
  );
  const treasuryBalance = await tokenContract.balanceOf(treasuryAddress);

  const callDataBurnDelvBalance = elfiTokenInterface.encodeFunctionData(
    "burn",
    [delvWalletAddress, delvBalance]
  );
  const callDataBurnFoundationBalance = elfiTokenInterface.encodeFunctionData(
    "burn",
    [delvWalletAddress, foundationBalance]
  );
  const callDataBurnTreasuryBalance = elfiTokenInterface.encodeFunctionData(
    "burn",
    [delvWalletAddress, treasuryBalance]
  );

  const hdTokenInterface = new ethers.utils.Interface(
    ERC20PermitWithMint__factory.abi
  );
  const callDataMintDelvBalance = hdTokenInterface.encodeFunctionData("mint", [
    delvWalletAddress,
    delvBalance.mul(parseEther("10")),
  ]);
  const callDataMintFoundationBalance = hdTokenInterface.encodeFunctionData(
    "mint",
    [delvWalletAddress, foundationBalance.mul(parseEther("10"))]
  );
  const callDataMintTreasuryBalance = hdTokenInterface.encodeFunctionData(
    "mint",
    [delvWalletAddress, treasuryBalance.mul(parseEther("10"))]
  );

  // Set the owner of the ELFI token to the zero address to revoke mint privileges.
  const callDataSetOwner = elfiTokenInterface.encodeFunctionData("setOwner", [
    ZERO_ADDRESS,
  ]);

  // Calldatas and targets to be executed from the Timelock
  const calldatasTimeLock = [
    // remove vaults from CoreVoting
    callDataChangeVaultStatusLockingVault,
    callDataChangeVaultStatusVestingVault,
    // remove gscVault from gscCoreVoting
    callDataChangeVaultStatusGscVault,
    // add vaults to CoreVoting
    callDataChangeVaultStatusHdLockingVault,
    callDataChangeVaultStatusHdMigrationRewardsVault,
    callDataChangeVaultStatusHdMigrationLinearVestingVault,
    // add vaults to gscCoreVoting
    callDataChangeVaultStatusHdGscVault,
    // set approvals for vaults from the treasury for HD tokens
    callDataTreasuryApproveHdLockingVault,
    callDataTreasuryApproveHdMigrationRewardsVault,
    callDataTreasuryApproveHdMigrationLinearVestingVault,
    callDataTreasuryApproveHdGscVault,
    // burn ELFI balances for Delv, Foundation, Treasury
    callDataBurnDelvBalance,
    callDataBurnFoundationBalance,
    callDataBurnTreasuryBalance,
    // mint 10x HD balances for Delv, Foundation, Treasury
    callDataMintDelvBalance,
    callDataMintFoundationBalance,
    callDataMintTreasuryBalance,
    // revoke mint privileges for the ELFI token
    callDataSetOwner,
  ];
  const targetsTimeLock = [
    // remove vaults from CoreVoting
    coreVotingAddress,
    coreVotingAddress,
    // remove gscVault from gscCoreVoting
    gscCoreVotingAddress,
    // add vaults to CoreVoting
    coreVotingAddress,
    coreVotingAddress,
    coreVotingAddress,
    // add vaults to gscCoreVoting
    gscCoreVotingAddress,
    // set approvals for vaults from the treasury for HD tokens
    treasuryAddress,
    treasuryAddress,
    treasuryAddress,
    treasuryAddress,
    // burn balances for Delv, Foundation, Treasury
    tokenAddress,
    tokenAddress,
    tokenAddress,
    // mint 10x balances for Delv, Foundation, Treasury
    hdTokenAddress,
    hdTokenAddress,
    hdTokenAddress,
    // revoke owner privileges for the ELFI token
    tokenAddress,
  ];

  // Hash of of the Timelock calldatas and targets
  const callHashTimelock = await createCallHash(
    calldatasTimeLock,
    targetsTimeLock
  );

  // CoreVoting proposal is a 'registerCall' on the Timelock with the hash above.
  const timeLockInterface = new ethers.utils.Interface(Timelock__factory.abi);
  const calldataCoreVoting = timeLockInterface.encodeFunctionData(
    "registerCall",
    [callHashTimelock]
  );

  // The proposal hash is the CoreVoting targets and calldatas.
  const targets = [timeLockAddress];
  const callDatas = [calldataCoreVoting];
  const proposalHash = await createCallHash(callDatas, targets);

  return {
    targets,
    callDatas,
    proposalHash,
    targetsTimeLock,
    calldatasTimeLock,
    callHashTimelock,
  };
}
