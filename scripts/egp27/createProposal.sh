
# Script to update grants with new values

NETWORK=hardhat

# preview the proposal
npx hardhat run scripts/egp27/previewProposal.ts --no-compile --network $NETWORK

npx hardhat run scripts/egp27/createProposal.ts --no-compile --network $NETWORK