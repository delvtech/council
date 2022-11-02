import { Signer } from "ethers";
import { UnfrozenVestingVault__factory } from "typechain";

import addressesJson from "src/addresses";
import { DAY_IN_BLOCKS } from "src/constants";

export async function deployVaultUpgrade(
  signer: Signer,
  staleBlockLag = DAY_IN_BLOCKS * 30
) {
  const deployer = new UnfrozenVestingVault__factory(signer);
  const { elementToken } = addressesJson.addresses;
  const vault = await deployer.deploy(elementToken, staleBlockLag);
  return vault;
}
