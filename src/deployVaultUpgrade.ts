import { Signer } from "ethers";
import { UnfrozenVestingVault__factory } from "typechain";
import hre from "hardhat";

import addressesJson from "src/addresses";
import { DAY_IN_BLOCKS } from "src/constants";
import { sleep } from "src/helpers/sleep";

export async function deployVaultUpgrade(
  signer: Signer,
  staleBlockLag = Math.round(DAY_IN_BLOCKS * 30)
) {
  const deployer = new UnfrozenVestingVault__factory(signer);
  const { elementToken } = addressesJson.addresses;

  console.log("deploying vault with:");
  console.log("staleBlockLag", staleBlockLag);
  console.log("elementToken", elementToken);

  const vault = await deployer.deploy(elementToken, staleBlockLag);

  await sleep(20_000);

  console.log("vault deployed at address", vault.address);
  console.log("verifying");

  await await hre.run("verify:verify", {
    address: vault.address,
    constructorArguments: [elementToken, staleBlockLag],
  });

  return vault;
}
