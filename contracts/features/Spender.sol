// This contract is current a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// Has governance tokens provided by the treasury, can execute calls to spend them
// Three separate functions which all spending different amounts

contract Spender {
    // A modifier which enforces that this is only called once per block
    // by loading a storage var for last call and checking it's not this block
    // and then setting that var to this block
    modifier oncePerBlock() {
        _;
    }

    // Checks that the caller is the governance contract
    modifier onlyGovernance() {
        _;
    }

    // Each of these should be settable by a function which is only callable
    // by the timelock.
    uint256 public smallSpendLimit;
    uint256 public mediumSpendLimit;
    uint256 public highSpendLimit;

    function smallSpend(uint256 amount, uint256 destination)
        external
        onlyGovernance
        oncePerBlock
    {
        // Checks that amount < small send limit
    }

    function mediumSpend(uint256 amount, uint256 destination)
        external
        onlyGovernance
        oncePerBlock
    {
        // Checks that amount < medium send limit
    }

    function largeSpend(uint256 amount, uint256 destination)
        external
        onlyGovernance
        oncePerBlock
    {
        // Checks that amount < high spend limit
    }
}
