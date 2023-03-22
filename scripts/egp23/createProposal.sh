
# Script to update grants with new values

NETWORK=hardhat
export USE_TEST_SIGNER=true

npx hardhat run scripts/egp23/createProposal.ts --no-compile --network $NETWORK