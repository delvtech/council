// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/Authorizable.sol";
import "../libraries/ReentrancyBlock.sol";

// Allows a call to be executed after a waiting period, also allows a call to
// be canceled within a waiting period.

contract Timelock is Authorizable, ReentrancyBlock {
    // Amount of time for the waiting period
    uint256 public waitTime;

    // Mapping of call hashes to block timestamps
    mapping(bytes32 => uint256) public callTimestamps;
    // Mapping from a call hash to its status of once allowed time increase
    mapping(bytes32 => bool) public timeIncreases;

    /// @notice Constructs this contract and sets state variables
    /// @param _waitTime amount of time for the waiting period
    /// @param _governance governance
    /// @param _gsc governance steering committee contract.
    constructor(
        uint256 _waitTime,
        address _governance,
        address _gsc
    ) Authorizable() {
        _authorize(_gsc);
        waitTime = _waitTime;
        setOwner(_governance);
    }

    /// @notice Stores at the callHash the current block timestamp
    /// @param callHash The hash to map the timestamp to
    function registerCall(bytes32 callHash) external onlyOwner {
        // We only want to register a call which is not already active
        require(callTimestamps[callHash] == 0, "already registered");
        // Set the timestamp for this call package to be the current time
        callTimestamps[callHash] = block.timestamp;
    }

    /// @notice Removes stored callHash data
    /// @param callHash Which entry of the mapping to remove
    function stopCall(bytes32 callHash) external onlyOwner {
        // We only want this to actually execute when a real thing is deleted to
        // prevent re-ordering attacks
        require(callTimestamps[callHash] != 0, "No call to be removed");
        // Do the actual deletion
        delete callTimestamps[callHash];
        delete timeIncreases[callHash];
    }

    /// @notice Execute the call if past the waiting period
    /// @param targets List of target addresses the timelock contract will interact with
    /// @param calldatas Execution calldata for each target
    function execute(address[] memory targets, bytes[] calldata calldatas)
        public
        nonReentrant
    {
        // hash provided data to access the mapping
        bytes32 callHash = keccak256(abi.encode(targets, calldatas));
        // call defaults to zero and cannot be executed before it is registered
        require(callTimestamps[callHash] != 0, "call has not been initialized");
        // call cannot be executed before the waiting period has passed
        require(
            callTimestamps[callHash] + waitTime < block.timestamp,
            "not enough time has passed"
        );
        // Gives a revert string to a revert that would occur anyway when the array is accessed
        require(targets.length == calldatas.length, "invalid formatting");
        // execute a package of low level calls
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call(calldatas[i]);
            // revert if a single call fails
            require(success == true, "call reverted");
        }
        // restore state after successful execution
        delete callTimestamps[callHash];
        delete timeIncreases[callHash];
    }

    /// @notice Allow a call from this contract to reset the wait time storage variable
    /// @param _waitTime New wait time to set to
    function setWaitTime(uint256 _waitTime) public {
        require(msg.sender == address(this), "contract must be self");
        waitTime = _waitTime;
    }

    /// @notice Allow an increase in wait time for a given call
    /// can only be executed once for each call
    /// @param timeValue Amount of time to increase by
    /// @param callHash The mapping entry to increase time
    function increaseTime(uint256 timeValue, bytes32 callHash)
        external
        onlyAuthorized
    {
        require(
            timeIncreases[callHash] == false,
            "value can only be changed once"
        );
        require(
            callTimestamps[callHash] != 0,
            "must have been previously registered"
        );
        // Increases the time till the call can be executed
        callTimestamps[callHash] += timeValue;
        // set mapping to indicate call has been changed
        timeIncreases[callHash] = true;
    }
}
