
# Script to update grants with new values

NETWORK=hardhat

export USE_TEST_SIGNER=true

# get the proposal arguments, preview the proposal
npx hardhat run scripts/egp-tbd/previewProposal.ts --no-compile --network $NETWORK

# sets quorum low so we can pass it when we create it
npx hardhat run scripts/helpers/setQuorum.ts --no-compile --network $NETWORK

# create the actual proposal
npx hardhat run scripts/egp-tbd/createProposal.ts --no-compile --network $NETWORK

# jump forward in time so we can execute the proposal
npx hardhat run scripts/helpers/jumpForward.ts --no-compile --network $NETWORK

# executing the proposal
npx hardhat run scripts/egp-tbd/executeProposal.ts --no-compile --network $NETWORK