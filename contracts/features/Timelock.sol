// This contract is current a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// Allows a call to be executed after a waiting period, also allows a call to
// be canceled within a waiting period.

contract Timelock {
    // Checks that the caller is the governance contract
    modifier onlyGovernance() {
        _;
    }

    // Checks that the caller is making an external call from
    // this address
    modifier onlySelf() {
        _;
    }

    function registerCall(bytes32 callHash) external onlyGovernance {
        // stores at the callHash the current block timestamp
    }

    function stopCall(bytes32 callHash) external onlyGovernance {
        // removes stored callHash data
    }

    function execute(
        bytes32 callHash,
        address target,
        bytes calldata callData
    ) external {
        // loads the stored callHash data and checks enough time has passed
        // Hashes the provided data and checks it matches the callHash
        // executes call
    }

    // Allow a call from this contract to reset the wait time storage variable
    function setWaitTime(uint256 waitTime) external onlySelf {}
}
