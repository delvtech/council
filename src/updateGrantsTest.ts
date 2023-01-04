import { parseEther } from "ethers/lib/utils";
import hre from "hardhat";
import {
  CoreVoting__factory,
  SimpleProxy__factory,
  Timelock__factory,
} from "typechain";

import addressesJson from "./addresses";
import { createVestingProposal } from "./createVestingProposal";
import { deployVaultUpgrade } from "./deployVaultUpgrade";
import grants from "./grants";
import { consoleGrants } from "./helpers/consoleGrants";
import { fetchGrantsByAddress } from "./helpers/fetchGrantAddresses";
import { logGrants } from "./helpers/logGrants";
import { resetFork } from "./helpers/resetFork";

/**
 *  Performs a mainnet fork test to update grants in the vesting vault.  This is a full runthrough
 *  that performs the following:
 *     Deploys a new UnfrozenVestingVault with ability to reduce/remove grants
 *     Takes a list of grant modifications in src/testGrants.ts and creates a proposal
 *     Submits the proposal to the CoreVoting contract
 *     Jumps in time and then executes that proposal
 *     Jumps in time again and then executes the proposal from the Timelock contract
 *
 *  In addition, the full list of grants are fetched and logged before and after the proposal so we
 *  can look at a diff of the grants.
 */
async function main() {
  resetFork();

  const { coreVoting, timeLock, vestingVault, lockingVault } =
    addressesJson.addresses;

  const granteeAddresses = grants.map((g) => g.who);

  // sisyphus.eth
  const signer = await hre.ethers.getImpersonatedSigner(
    "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
  );

  // give some eth
  await hre.network.provider.send("hardhat_setBalance", [
    "0x0d2026b3EE6eC71FC6746ADb6311F6d3Ba1C000B",
    parseEther("1000").toHexString().replace("0x0", "0x"),
  ]);

  // give some eth
  await hre.network.provider.send("hardhat_setBalance", [
    signer.address,
    parseEther("1000").toHexString().replace("0x0", "0x"),
  ]);

  // log all the grants
  const grantsBeforeProposal = await fetchGrantsByAddress(vestingVault, signer);
  console.log("logging all grants");
  logGrants(grantsBeforeProposal);
  // console the grants in grants.ts
  consoleGrants(
    Object.fromEntries(
      Object.entries(grantsBeforeProposal).filter(([address]) =>
        granteeAddresses.includes(address)
      )
    )
  );

  //*************************************************//
  // first, deploy the unfrozen vesting vault
  //*************************************************//
  console.log("deploying the upgraded vesting vault");
  const unfrozenVault = await deployVaultUpgrade(signer);

  //*************************************************//
  // now create the proposoal
  //*************************************************//
  console.log("creating the proposal");
  const vestingVaultProxy = SimpleProxy__factory.connect(vestingVault, signer);
  const frozenVaultAddress = await vestingVaultProxy.proxyImplementation();
  const votingVaultAddresses = [lockingVault];
  const extraVaultDatas = ["0x00"];

  // set quourm to 1 so we can pass the proposal
  const quorumSlot = "0x3";
  const value = hre.ethers.utils.hexlify(hre.ethers.utils.zeroPad("0x01", 32)); // 100k quorum
  await hre.network.provider.send("hardhat_setStorageAt", [
    coreVoting,
    quorumSlot,
    value,
  ]);

  // create propopsal
  const proposalInfo = await createVestingProposal(
    signer,
    grants,
    unfrozenVault.address,
    votingVaultAddresses,
    extraVaultDatas
  );

  //*************************************************//
  // vote on then expire the proposal so it passes
  //*************************************************//
  const { proposalId, targets, callDatas, targetsTimeLock, calldatasTimeLock } =
    proposalInfo;

  // check that it's passing
  const coreVotingContract = CoreVoting__factory.connect(coreVoting, signer);
  const votingPower = await coreVotingContract.getProposalVotingPower(
    proposalId
  );
  const quorum = await coreVotingContract.baseQuorum();
  // [yes, no, abstain] voting power
  if (votingPower[0].lt(quorum) || votingPower[0].lt(votingPower[1])) {
    console.log("not enough voting power to pass");
    console.log(
      "votingPower",
      votingPower.map((bn) => bn.toString())
    );
    console.log("quorum", quorum.toString());
    return;
  }
  const lockDuration = await coreVotingContract.lockDuration();
  const lockDurationHexString = lockDuration.toHexString().replace("0x0", "0x");
  await hre.network.provider.send("hardhat_mine", [lockDurationHexString]);

  console.log("execute proposal");
  const result = await coreVotingContract.execute(
    proposalId,
    targets,
    callDatas
  );
  await result.wait(1);
  console.log("executed proposal");

  const timeLockContract = Timelock__factory.connect(timeLock, signer);
  const waitTime = await timeLockContract.waitTime();
  const waitTimeHexString = waitTime.add(1).toHexString().replace("0x0", "0x");
  await hre.network.provider.send("hardhat_mine", [waitTimeHexString]);
  console.log("executing timelock");
  await timeLockContract.execute(targetsTimeLock, calldatasTimeLock);

  //*************************************************//
  // check to see that vesting vault address is the original
  //*************************************************//
  const vestingProxy = SimpleProxy__factory.connect(vestingVault, signer);
  const implementationAddress = await vestingProxy.proxyImplementation();
  console.log("vestingProxyAddress", vestingProxy.address);
  console.log("implementationAddress", implementationAddress);
  console.log("frozenVaultAddress", frozenVaultAddress);

  //*************************************************//
  // check to see that the grants are updated as expected
  //*************************************************//
  console.log("logging grants after proposal executed");
  const grantAddressesBeforeProposal = Object.entries(grantsBeforeProposal).map(
    ([address]) => address
  );
  consoleGrants(
    Object.fromEntries(
      Object.entries(grantsBeforeProposal).filter(([address]) =>
        granteeAddresses.includes(address)
      )
    )
  );

  const grantsAfterProposal = await fetchGrantsByAddress(
    vestingVault,
    signer,
    grantAddressesBeforeProposal
  );
  logGrants(grantsAfterProposal, "grantsAfter.csv");
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
