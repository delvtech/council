
# Script to update grants with new values

NETWORK=localhost

# deploy the upgrade contract
npx hardhat run scripts/deployUpgradeContract.ts --no-compile --network $NETWORK

# creating and executing the proposal
npx hardhat run scripts/previewUpgradeProposal.ts --no-compile --network $NETWORK

#remove this for actual executuion
npx hardhat run scripts/setQuorum.ts --no-compile --network $NETWORK

npx hardhat run scripts/createUpgradeProposal.ts --no-compile --network $NETWORK

#remove this for actual execution
npx hardhat run scripts/jumpForward.ts --no-compile --network $NETWORK

npx hardhat run scripts/executeUpgradeProposal.ts --no-compile --network $NETWORK