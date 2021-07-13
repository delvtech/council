// This contract is current a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// This vault allows someone to gain one vote on the GSC and tracks that status through time
// it will be a voting vault of the gsc voting contract

contract GSCVault {
    // Checks that the caller is the primary governance timelock [not the gsc voting contract]
    modifier onlyGovernance() {
        _;
    }

    uint256 public votingPowerBound;

    function join(address[] calldata votingVaults) external {
        // Checks that each voting vault is registered
        // calls the 'queryVotePower' on the voting vaults and then sums the amount
        // if larger than votingPowerBound
        // Then if the user has been challenged removes the challenge
        // otherwise add one vote
    }

    // issues a challenge for a member to verify that they have enough votes
    function challenge(address who) external {
        // Add a challenge plus timestamp to 'who', require that they
        // be registered before
    }

    function kick(address who) external {
        // if who has been challenged for more than a configurable immutable challenge
        // period then remove their votes
    }

    function queryVotingPower(address who, uint256 when) public {
        // function which looks up who's voting power at block when, fulfills the vault interface
        // TODO - consider giving the gov address a huge number of votes
    }
}
