// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../interfaces/IERC20.sol";
import "../interfaces/IVotingVault.sol";
import "../interfaces/ILockingVault.sol";
import "../libraries/Authorizable.sol";
import "../libraries/MerkleRewards.sol";

// This contract follows an optimistic reward model, an authorized address the 'proposer'
// can submit a new merkle root and after a delay it is set the new merkle root.
// Durning the period before the root is accepted governance can prevent the update
// by removing that proposed root and resetting the timer.

// We've chosen this model to allow rewards flexibility. Any replicable off-chain program
// which can be run and verified by governance and community members, can be the rewards
// algorithm followed by this contract.

contract OptimisticRewards is MerkleRewards, Authorizable, IVotingVault {
    // The optional pending root for this rewards contract
    bytes32 public pendingRoot;
    // The time the pending proposal root was proposed. Note always check for 0 here when using.
    uint256 public proposalTime;
    // The address with the power to propose new roots.
    address public proposer;
    // Defaults to one week
    uint256 public challengePeriod = 7 days;

    /// @notice Constructs this contract and sets state variables
    /// @param _governance The address which owns this contract and can reset other vars
    /// @param _startingRoot The starting merkle root for this contract
    /// @param _proposer The address which can propose new roots
    /// @param _revoker The address which can stop proposed roots
    /// @param _token The token in which rewards are paid
    /// @param _lockingVault The governance locking vault for this token
    constructor(
        address _governance,
        bytes32 _startingRoot,
        address _proposer,
        address _revoker,
        IERC20 _token,
        ILockingVault _lockingVault
    ) MerkleRewards(_startingRoot, _token, _lockingVault) {
        proposer = _proposer;
        _authorize(_revoker);
        setOwner(_governance);
    }

    /// @notice Two combined functions (1) check if the previous rewards are confirmed and if so post them
    ///         (2) propose rewards for the next period. By combining into one call we just need one regular maintenance
    ///         call instead of two.
    /// @param newRoot The merkle root of the proposed new rewards
    /// @dev NOTE - If called before a proposed root would take effect it will overwrite that root AND timestamp. Meaning
    ///             valid rewards may be delayed by a sloppy proposer sending a tx even a few minutes ahead of time.
    function proposeRewards(bytes32 newRoot) external {
        // First authorize the call
        require(msg.sender == proposer, "Not proposer");
        // Second check if a valid outstanding update can be propagated to allow people to claim
        if (
            // We check there is some update pending, no setting to zero
            pendingRoot != bytes32(0) &&
            proposalTime != 0 &&
            // Then we check enough time has passed
            block.timestamp > proposalTime + challengePeriod
        ) {
            // Set the root in the MerkleRewards contract
            rewardsRoot = pendingRoot;
        }
        // Update state
        pendingRoot = newRoot;
        proposalTime = block.timestamp;
    }

    /// @notice Attempts to load the voting power of a user via merkleProofs
    /// @param user The address we want to load the voting power of
    // @param blockNumber unused in this contract
    /// @param extraData Abi encoded vault balance merkle proof pair
    /// @return the number of votes
    function queryVotePower(
        address user,
        uint256,
        bytes calldata extraData
    ) external view override returns (uint256) {
        // Decode the extra data
        (uint256 totalGrant, bytes32[] memory proof) =
            abi.decode(extraData, (uint256, bytes32[]));
        // Hash the user plus the total grant amount
        bytes32 leafHash = keccak256(abi.encodePacked(user, totalGrant));

        // Verify the proof for this leaf
        require(
            MerkleProof.verify(proof, rewardsRoot, leafHash),
            "Invalid Proof"
        );

        // Return the total votes for the user
        // Note - If you want to set up a system where unclaimed rewards have preferential voting treatment
        //        it is quite easy to add a multiplier to these lines and it will achieve that.
        uint256 votes = totalGrant - claimed[user];
        return (votes);
    }

    /// @notice Allows a revoker to remove a rewards root. This is a spam vector given a malicious revoker,
    ///         with the only solution being governance removal of that authorized revoker.
    function challengeRewards() external onlyAuthorized {
        // Delete pending rewards
        pendingRoot = bytes32(0);
        proposalTime = 0;
    }

    /// @notice Allows changing the proposer by governance
    /// @param _proposer The new proposer address
    function setProposer(address _proposer) external onlyOwner {
        proposer = _proposer;
    }

    /// @notice Allows changing the proposal challenge period by governance
    /// @param _challengePeriod The new challenge period
    function setChallengePeriod(uint256 _challengePeriod) external onlyOwner {
        challengePeriod = _challengePeriod;
    }
}
