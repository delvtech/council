import { formatEther } from "ethers/lib/utils";
// # Script to update grants with new values
import hre from "hardhat";
import { main as setQuorum } from "scripts/helpers/setQuorum";
import { main as jumpForward } from "scripts/helpers/jumpForward";
import { previewProposal } from "./previewProposal";
import { executeProposal } from "./executeProposal";
import { executeTimelock } from "./executeTimelock";
import { createProposal } from "./createProposal";
import { getSigner } from "scripts/helpers/getSigner";
import { ERC20Permit__factory } from "typechain";
import addressesJson from "src/addresses";
import { BigNumber, Wallet } from "ethers";

const delvWalletAddress = "0xF6094C3A380AD6161Fb8240F3043392A0E427CAC";

async function main() {
  const signer = await getSigner();
  if (!signer) {
    return;
  }

  const fundsBefore = await printFunds(signer);

  await previewProposal();
  await setQuorum();
  await createProposal(signer);
  await jumpForward();
  await executeProposal(signer);
  await increaseTime(8 * 24 * 60 * 60);
  await executeTimelock(signer);

  const fundsAfter = await printFunds(signer);
  printSummary(fundsBefore, fundsAfter);
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

async function increaseTime(seconds: number) {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
}

async function printFunds(signer: Wallet) {
  const { elementToken, treasury } = addressesJson.addresses;
  const tokenContract = ERC20Permit__factory.connect(elementToken, signer);
  const delvBalance = await tokenContract.balanceOf(delvWalletAddress);
  const treasuryBalance = await tokenContract.balanceOf(treasury);
  console.log("delvBalance", delvWalletAddress, formatEther(delvBalance));
  console.log("treasuryBalance", treasury, formatEther(treasuryBalance));

  return { delvBalance, treasuryBalance };
}

function printSummary(
  fundsBefore: { delvBalance: BigNumber; treasuryBalance: BigNumber },
  fundsAfter: { delvBalance: BigNumber; treasuryBalance: BigNumber }
) {
  const delvDifference = fundsAfter.delvBalance.sub(fundsBefore.delvBalance);
  const treasuryDifference = fundsAfter.treasuryBalance.sub(
    fundsBefore.treasuryBalance
  );
  console.log("delvDifference", formatEther(delvDifference));
  console.log("treasuryDifference", formatEther(treasuryDifference));
}
