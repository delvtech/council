import { formatEther } from "ethers/lib/utils";
import { VestingVaultStorage } from "typechain/contracts/vaults/UnfrozenVestingVault";

export async function consoleGrants(
  grantsByAddress: Record<string, VestingVaultStorage.GrantStructOutput>
) {
  Object.entries(grantsByAddress).forEach(([address, grant], index) => {
    console.log(`grant${index}:`);
    console.log("  address           ", address);
    console.log("  allocation        ", formatEther(grant.allocation));
    console.log("  withdrawn         ", formatEther(grant.withdrawn));
    console.log(
      "  created           ",
      grant.created.toString(),
      new Date(grant.created.toNumber() * 1000).toDateString()
    );
    console.log(
      "  cliff             ",
      grant.cliff.toString(),
      new Date(grant.cliff.toNumber() * 1000).toDateString()
    );
    console.log(
      "  expiration        ",
      grant.expiration.toString(),
      new Date(grant.expiration.toNumber() * 1000).toDateString()
    );
    console.log("  latestVotingPower ", formatEther(grant.latestVotingPower));
    console.log("  delegatee         ", grant.delegatee);
    console.log(
      "  range             ",
      grant.range.map((bn) => formatEther(bn))
    );
  });
}
