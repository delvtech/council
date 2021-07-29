// This contract is currently a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/Authorizable.sol";

// Allows a call to be executed after a waiting period, also allows a call to
// be canceled within a waiting period.

contract Timelock is Authorizable {
    uint256 public waitTime;
    address public governance;
    mapping(bytes32 => uint256) public callTimestamps;

    constructor(uint256 _waitTime, address _governance) Authorizable() {
        waitTime = _waitTime;
        setOwner(_governance);
        governance = _governance;
    }

    function registerCall(bytes32 callHash) external onlyOwner {
        // stores at the callHash the current block timestamp
        callTimestamps[callHash] = block.timestamp;
    }

    function stopCall(bytes32 callHash) external onlyOwner {
        // removes stored callHash data
        delete callTimestamps[callHash];
    }

    function execute(
        bytes32 callHash,
        address target,
        bytes calldata callData
    ) external {
        // loads the stored callHash data and checks enough time has passed
        // Hashes the provided data and checks it matches the callHash
        // executes call

        require(
            block.timestamp >= callTimestamps[callHash] + waitTime,
            "not enough time has passed"
        );

        require(
            keccak256(abi.encodePacked(callData)) == callHash,
            "hash mismatch"
        );

        // execute call
        target.call(callData);
    }

    // Allow a call from this contract to reset the wait time storage variable
    function setWaitTime(uint256 _waitTime) external onlyOwner {
        waitTime = _waitTime;
    }
}
