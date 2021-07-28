// This contract is currently a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// Allows a call to be executed after a waiting period, also allows a call to
// be canceled within a waiting period.

contract Timelock {
    uint256 public waitTime;
    address public self;
    bool public isGovernance;

    // Mapping for callHashes to timestamps?
    mapping(bytes32 => uint256) public callTimestamps;

    constructor(
        uint256 _waitTime,
        address _self,
        bool _isGovernance
    ) {
        waitTime = _waitTime;
        self = _self;
        isGovernance = _isGovernance;
    }

    // Checks that the caller is the governance contract
    modifier onlyGovernance() {
        require(isGovernance == true, "Must be a governance contract");
        _;
    }

    // Checks that the caller is making an external call from
    // this address
    modifier onlySelf() {
        require(self == msg.sender);
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

    function execute(
        bytes32 callHash,
        address target,
        bytes calldata callData
    ) external {
        // loads the stored callHash data and checks enough time has passed
        // Hashes the provided data and checks it matches the callHash
        // executes call

        bytes256 timeStamp = callTimestamps[callHash];
        require(timeStamp >= waitTime, "Not enough time has passed");

        // this should be hashed first, but I'm not sure which hashing function should be used
        bytes32 dataHash = callData;
        require(
            dataHash == callHash,
            "Provided data does not match the call hash"
        );

        // execute call
    }

    // Allow a call from this contract to reset the wait time storage variable
    function setWaitTime(uint256 _waitTime) external onlySelf {
        waitTime = _waitTime;
    }
}
