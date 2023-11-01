import { Signer } from "ethers";
import { formatEther, parseEther } from "ethers/lib/utils";
import hre from "hardhat";
import {
  SimpleProxy__factory,
  UnfrozenVestingVault2__factory,
} from "typechain";

import { DAY_IN_BLOCKS } from "src/constants";
import { sleep } from "src/helpers/sleep";

import addressesJson from "./addresses";
// import { resetFork } from "./helpers/resetFork";

/**
 *  Performs a mainnet fork test to read the unassigned tokens in the VestingVault
 *  that performs the following:
 *     Deploys a new UnfrozenVestingVault2 with ability read unassigned()
 *     Reads the unassigned vaule
 *
 *  In addition, the full list of grants are fetched and logged before and after the proposal so we
 *  can look at a diff of the grants.
 */
export async function main() {
  // this breaks impersonate signer
  // resetFork();

  const { vestingVault } = addressesJson.addresses;

  // sisyphus.eth
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"],
  });
  const signer = await hre.ethers.getSigner(
    "0xC77FA6C05B4e472fEee7c0f9B20E70C5BF33a99B"
  );

  // give some eth
  await hre.network.provider.send("hardhat_setBalance", [
    signer.address,
    parseEther("1000").toHexString().replace("0x0", "0x"),
  ]);

  //*************************************************//
  // first, deploy the unfrozen vesting vault
  //*************************************************//
  console.log("deploying the upgraded vesting vault");
  // this one has an unassigned() method
  const unfrozenVault = await deployVault2Upgrade(signer);
  console.log("unfrozenVault", unfrozenVault.address);

  //*************************************************//
  // replace the implementation
  //*************************************************//
  const proxyImplementationSlot = "0x0";
  const value = hre.ethers.utils.hexlify(
    hre.ethers.utils.zeroPad(unfrozenVault.address, 32)
  );
  await hre.network.provider.send("hardhat_setStorageAt", [
    vestingVault,
    proxyImplementationSlot,
    value,
  ]);

  //*************************************************//
  // check to see that vesting vault address is the proxy implementation
  //*************************************************//
  const vestingVaultProxyContract = SimpleProxy__factory.connect(
    vestingVault,
    signer
  );
  const implementationAddress =
    await vestingVaultProxyContract.proxyImplementation();
  console.log("implementationAddress", implementationAddress);
  console.log("unfrozenVault.address", unfrozenVault.address);

  //*************************************************//
  // check to see that the grants are updated as expected
  //*************************************************//
  const vestingVaultContract = UnfrozenVestingVault2__factory.connect(
    vestingVault,
    signer
  );
  const unassigned = await vestingVaultContract.unassigned();
  console.log("unassigned", formatEther(unassigned));
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });

export async function deployVault2Upgrade(
  signer: Signer,
  staleBlockLag = Math.round(DAY_IN_BLOCKS * 30)
) {
  const deployer = new UnfrozenVestingVault2__factory(signer);
  const { elementToken } = addressesJson.addresses;

  console.log("deploying vault with:");
  console.log("  staleBlockLag", staleBlockLag);
  console.log("  elementToken", elementToken);

  const vault = await deployer.deploy(elementToken, staleBlockLag);

  console.log("sleeping for 20s...");
  await sleep(20_000);

  console.log("\n vault deployed at address", vault.address);

  return vault;
}
