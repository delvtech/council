
# Script to update grants with new values

NETWORK=localhost

npx hardhat run scripts/deployUpgradeContract.ts --no-compile --network $NETWORK
npx hardhat run scripts/previewUpgradeProposal.ts --no-compile --network $NETWORK
npx hardhat run scripts/setQuorum.ts --no-compile --network $NETWORK
npx hardhat run scripts/createUpgradeProposal.ts --no-compile --network $NETWORK
npx hardhat run scripts/jumpForward.ts --no-compile --network $NETWORK
npx hardhat run scripts/executeUpgradeProposal.ts --no-compile --network $NETWORK