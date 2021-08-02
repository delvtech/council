// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../interfaces/ICoreVoting.sol";
import "../interfaces/IVotingVault.sol";
import "../libraries/Authorizable.sol";

// This vault allows someone to gain one vote on the GSC and tracks that status through time
// it will be a voting vault of the gsc voting contract
// It is not going to be an upgradable proxy since only a few users use it and it doesn't have
// high migration overhead. It also won't have full historical tracking which will cause
// GSC votes to behave differently than others. Namely, anyone who is a member at any point
// in the voting period can vote.

contract GSCVault is Authorizable {
    // This struct will compact into one evm storage word for gas efficient loads
    struct Status {
        bool isMember;
        bool isChallenged;
        uint64 challengeBlock;
    }
    // Tracks which people are in the GSC and if they have been challenged
    mapping(address => Status) public members;
    // The core voting contract with approved voting vaults
    ICoreVoting public coreVoting;
    // The amount of votes needed to be on the GSC
    uint256 public votingPowerBound;
    // The challenge duration
    uint256 public challengeDuration = 1330;

    /// @notice constructs this contract and initial vars
    /// @param _coreVoting The core voting contract
    /// @param _votingPowerBound The first voting power bound
    /// @param _owner The owner of this contract, should be the timelock contract
    constructor(
        ICoreVoting _coreVoting,
        uint256 _votingPowerBound,
        address _owner
    ) {
        // Set the state variables
        coreVoting = _coreVoting;
        votingPowerBound = _votingPowerBound;
        // Set the owner
        setOwner(address(_owner));
    }

    /// @notice Called to prove membership in the GSC either as a first time
    ///         joiner or to respond to a challenge
    /// @param votingVaults The contracts this person has their voting power in
    function proveMembership(address[] calldata votingVaults) external {
        // We loop through the voting vaults to check they are authorized
        // We check all up front to prevent any reentrancy or weird side effects
        for (uint256 i = 0; i < votingVaults.length; i++) {
            // Call the mapping the core voting contract to check that
            // the provided address is in fact approved.
            // Note - Post Berlin hardfork this repeated access is quite cheap.
            bool vaultStatus = coreVoting.approvedVaults(votingVaults[i]);
            require(vaultStatus, "Voting vault not approved");
        }
        // Now we tally the caller's voting power
        uint256 totalVotes = 0;
        // Parse through the list of vaults
        for (uint256 i = 0; i < votingVaults.length; i++) {
            // Call the vault to check last block's voting power
            // Last block to ensure there's no flash loan or other
            // intra contract interaction
            uint256 votes =
                IVotingVault(votingVaults[i]).queryVotePower(
                    msg.sender,
                    block.number - 1
                );
            // Add up the votes
            totalVotes += votes;
        }
        // Require that the caller has proven that they have enough votes
        require(totalVotes >= votingPowerBound, "Not enough votes");
        // If that passes we store that the caller is a member
        // This storage will wipe out that the caller has been challenged
        members[msg.sender] = Status(true, false, 0);
    }

    /// @notice Challenges a GSC member to re prove their membership within a period [default ~ 48 hours] or be kick-able
    /// @param who The address to challenge.
    /// @dev This function means that there's a trolling attack which can force GSC members to
    ///       spend gas, but because it costs gas it's fairly unlikely to be seen in the wild.
    function challenge(address who) external {
        // Load the status of who, and do not assume they are really a GSC member
        Status storage currentStatus = members[who];
        // Store that they have been challenged plus timestamp
        members[who] = Status(
            currentStatus.isMember,
            true,
            uint64(block.number)
        );
    }

    /// @notice Removes a member who has not proven membership criteria within the time period
    /// @param who The member address
    function kick(address who) external {
        // Load the 'who' status
        Status storage currentStatus = members[who];
        // The challenge must be active and it must be at least 'challengeDuration' blocks ago
        uint256 blocksPassed =
            (block.number - uint256(currentStatus.challengeBlock));
        require(blocksPassed >= challengeDuration, "Not enough time passed");
        require(currentStatus.isChallenged, "Challenge failed or not started");
        // We delete the entry for this GSC member
        delete members[who];
    }

    /// @notice Queries voting power, GSC members get one vote and the owner gets 100k
    /// @param who Which address to query
    /// @dev Because this function ignores the when variable it creates a unique voting system
    ///      and should not be plugged in with truly historic ones.
    function queryVotingPower(address who, uint256)
        public
        view
        returns (uint256)
    {
        // If the address queried is the owner they get a huge number of votes
        // This allows the primary governance timelock to take any action the GSC
        // can make or block any action the GSC can make. But takes as many votes as
        // a protocol upgrade.
        if (who == owner) {
            return 100000;
        }
        // If the who is in the GSC return 1 and otherwise return 0
        if (members[who].isMember) {
            return 1;
        } else {
            return 0;
        }
    }

    /// Functions to allow gov to reset the state vars

    /// @notice Sets the core voting contract
    /// @param _newVoting The new core voting contract
    function setCoreVoting(ICoreVoting _newVoting) external onlyOwner() {
        coreVoting = _newVoting;
    }

    /// @notice Sets the vote power bound
    /// @param _newBound The new vote power bound
    function setVotePowerBound(uint256 _newBound) external onlyOwner() {
        votingPowerBound = _newBound;
    }

    /// @notice Sets the vote power bound
    /// @param _newDuration The new challenge duration
    function setChallengeDuration(uint256 _newDuration) external onlyOwner() {
        challengeDuration = _newDuration;
    }
}
