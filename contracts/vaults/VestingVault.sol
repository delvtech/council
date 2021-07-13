// This contract is currently a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

contract VestingVault {
    // This contract has a privileged grant manager who can add grants or remove grants
    // It will not transfer in on each grant but rather check for solvency via state variables.

    modifier onlyManager() {
        _;
    }

    // TODO Grant struct type

    function addGrant(
        address who /*,Grant grant*/
    ) public onlyManager {
        // adds the grant for the user, removes the total amount from the stored
        // balance of this contract
        // Adds voting power for the holder of the voting vault equal to amount
        // that they will vest.
    }

    function removeGrant(address who) public onlyManager {
        // Removes the grant for the user and pays out any vested but unclaimed
        // tokens by sending them to the user. Adds the net about which will
        // no longer have to be paid back to the stored balance.
    }

    function deposit(uint256 amount) public onlyManager {
        // transfers amount from the manager and adds it to solvency
    }

    function delegate(address to) public {
        // allows someone who has a vesting grant to delegate their voting power
    }

    function claim() public {
        // removes all vested tokens for the msg.sender
        // also removes that voting power
    }

    function queryVotingPower(address who, uint256 when) public {
        // function which looks up who's voting power at block when, fulfills the vault interface
    }
}
