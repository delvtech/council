// This contract is currently a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../libraries/Authorizable.sol";

// Allows a call to be executed after a waiting period, also allows a call to
// be canceled within a waiting period.

contract Timelock is Authorizable {
    uint256 public waitTime;
    address public governance;
    mapping(bytes32 => uint256) public callTimestamps;
    mapping(bytes32 => bool) public timeIncreases;

    constructor(
        uint256 _waitTime,
        address _governance,
        address _gsc
    ) Authorizable() {
        _authorize(_gsc);
        waitTime = _waitTime;
        setOwner(_governance);
        governance = _governance;
    }

    // Checks that the caller is a governance contract
    modifier onlyGovernance() {
        require(msg.sender == governance, "contract must be governance");
        _;
    }

    function registerCall(bytes32 callHash) external onlyGovernance {
        // stores at the callHash the current block timestamp
        callTimestamps[callHash] = block.timestamp;
    }

    function stopCall(bytes32 callHash) external onlyGovernance {
        // removes stored callHash data
        delete callTimestamps[callHash];
    }

    function execute(address[] memory targets, bytes[] calldata calldatas)
        public
    {
        // loads the stored callHash data and checks enough time has passed
        // Hashes the provided data and checks it matches the callHash
        // executes call
        bytes32 callHash = keccak256(abi.encode(targets, calldatas));
        require(callTimestamps[callHash] != 0, "call has not been initialized");
        require(
            callTimestamps[callHash] + waitTime < block.timestamp,
            "not enough time has passed"
        );
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory returnData) =
                targets[i].call(calldatas[i]);
            require(success == true, "call reverted");
        }
    }

    // Allow a call from this contract to reset the wait time storage variable
    function setWaitTime(uint256 _waitTime) public {
        require(msg.sender == address(this), "contract must be self");
        waitTime = _waitTime;
    }

    function increaseTime(uint256 timeValue, bytes32 callHash)
        external
        onlyAuthorized
    {
        require(
            timeIncreases[callHash] == false,
            "value can only be changed once"
        );
        callTimestamps[callHash] += timeValue;
        timeIncreases[callHash] = true;
    }
}
