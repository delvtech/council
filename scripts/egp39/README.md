## Installation
Follow the installation instructions for the repository

## Testing
To test, make sure that the following settings are set in your .env:

```bash
# proposal arguments
BALLOT=0 # 0, yes, 1 no, 2 abstain
NUM_DAYS_TO_EXECUTE=14

# local
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 # hardhat signer 0
ALCHEMY_MAINNET_API_KEY=<API_KEY>
USE_TEST_SIGNER=true
```

You'll need to update the private key to an address with eth in it for performing the actual creation and execution scripts

Assuming the types have been built correctly during the installation process, you can now run:

```bash
npx hardhat node
```

In a separate terminal, run:

```bash
npx hardhat run scripts/egp39/testCreateAndExecute.ts --no-compile --network hardhat
```
NOTE that the network is hardhat, not mainnet

There will be a lot of output regarding the grants created and the new unassigned tokens.  Make sure these values match what is expected.

## CREATING THE PROPOSAL ARGUMENTS
To create the proposal arguments, run:

```bash
npx hardhat run scripts/egp39/executables/executablePreviewProposal.ts --no-compile --network mainnet

```

Note that these should be created already from running the testCreateAndExecute script.

## CREATING THE PROPOSAL
To actually create the proposal, you'll simply update your environment to set USE_TEST_SIGNER to false, and updating the private key:

```bash
USE_TEST_SIGNER=false
PRIVATE_KEY=ACTUAL_KEY!!!!
```

Then run:

```bash
npx hardhat run scripts/egp39/executables/executableCreateProposal.ts --no-compile --network mainnet
```

NOTE that the network is updated to mainnet, not hardhat

## EXECUTING THE PROPOSAL
If the proposal passes quorum, then we can execute it:

```bash
 npx hardhat run scripts/egp39/executables/executableExecuteProposal.ts --no-compile --network mainnet
```

## EXECUTING THE TIMELOCKED PROPOSAL
If the proposal passes the wait time on the timelock, then we can execute it:

```bash
 npx hardhat run scripts/egp39/executables/executableExecuteTimelock.ts --no-compile --network mainnet
```