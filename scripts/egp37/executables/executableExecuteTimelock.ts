import { getSigner } from "scripts/helpers/getSigner";
import { executeTimelock } from "../executeTimelock";

async function main() {
  const signer = await getSigner();
  await executeTimelock(signer);
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
