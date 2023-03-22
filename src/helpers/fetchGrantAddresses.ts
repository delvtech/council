import { Provider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import hre from "hardhat";
import { VestingVault__factory } from "typechain";
import { VestingVaultStorage } from "typechain/contracts/vaults/VestingVault.sol/AbstractVestingVault";

export async function fetchGrantsByAddress(
  vestingVault: string,
  signer: Provider | SignerWithAddress | Wallet,
  preserveAddresses: string[] = []
): Promise<Record<string, VestingVaultStorage.GrantStructOutput>> {
  const vestingVaultContract = VestingVault__factory.connect(
    vestingVault,
    signer
  );

  // fetch all VoteChange events and store into an object
  const voteFilter = vestingVaultContract.filters.VoteChange();
  const votes = await vestingVaultContract.queryFilter(voteFilter);
  const grantAddressesRecord: Record<string, boolean> = {};
  votes.forEach((v) => (grantAddressesRecord[v.args.from] = true));
  votes.forEach((v) => (grantAddressesRecord[v.args.to] = true));
  const grantAddresses = Object.keys(grantAddressesRecord)
    .filter((a) => a != hre.ethers.constants.AddressZero)
    .filter((a) => a != "0x0000000000000000000000000000000000000001");

  // now fetch the actual grants
  const txs = grantAddresses.map((a) => vestingVaultContract.getGrant(a));
  const grants: VestingVaultStorage.GrantStructOutput[] = await Promise.all(
    txs
  );
  const grantsByAddress: Record<string, VestingVaultStorage.GrantStructOutput> =
    {};
  grantAddresses.forEach((a, i) => (grantsByAddress[a] = grants[i]));

  // remove grants that don't have an allocation (unless they should be preserved)
  grantAddresses.forEach((a) => {
    if (grantsByAddress[a].allocation.eq(0) && !preserveAddresses.includes(a)) {
      delete grantsByAddress[a];
    }
  });
  return grantsByAddress;
}
