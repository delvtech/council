import { formatEther } from "ethers/lib/utils";
import fs from "fs";
import { VestingVaultStorage } from "typechain/contracts/vaults/UnfrozenVestingVault";

export function logGrants(
  grantsByAddress: Record<string, VestingVaultStorage.GrantStructOutput>,
  fileName = "grants.csv"
): void {
  const entries = Object.entries(grantsByAddress);

  const fd = fs.openSync(fileName, "w");
  fs.writeSync(
    fd,
    "address,allocation,withdrawn,created,cliff,expiration,latestVotingPower,delegatee,rangeStart,rangeEnd\n"
  );

  for (let i = 0; i < entries.length; i++) {
    const [address, grant] = entries[i];
    fs.writeSync(
      fd,
      `${address},${formatEther(grant.allocation)},${formatEther(
        grant.withdrawn
      )},${grant.created.toNumber()},${grant.cliff.toNumber()},${grant.expiration.toNumber()},${formatEther(
        grant.latestVotingPower
      )},${grant.delegatee},${grant.range.map((bn) => formatEther(bn))}\n`
    );
  }
}
