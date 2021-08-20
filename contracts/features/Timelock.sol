// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../libraries/Authorizable.sol";

// Allows a call to be executed after a waiting period, also allows a call to
// be canceled within a waiting period.

contract Timelock is Authorizable {
    // Amount of time for the waiting period
    uint256 public waitTime;
    // the governance address
    address public governance;
    // Mapping of call hashes to block timestamps
    mapping(bytes32 => uint256) public callTimestamps;
    // Mapping from a call hash to its status of once allowed time increase
    mapping(bytes32 => bool) public timeIncreases;

    /// @notice Constructs this contract and sets state variables
    /// @param _waitTime amount of time for the waiting period
    /// @param _governance governance
    /// @param _gsc governance steering comity contract.
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

    /// @dev Modifier checks if the msg.sender is the governance contract
    modifier onlyGovernance() {
        require(msg.sender == governance, "contract must be governance");
        _;
    }

    /// @notice Stores at the callHash the current block timestamp
    /// @param callHash The hash to map the timestamp to
    function registerCall(bytes32 callHash) external onlyGovernance {
        callTimestamps[callHash] = block.timestamp;
    }

    /// @notice Removes stored callHash data
    /// @param callHash Which entry of the mapping to remove
    function stopCall(bytes32 callHash) external onlyGovernance {
        delete callTimestamps[callHash];
    }

    /// @notice Execute the call if past the waiting period
    /// @param targets List of target addresses the timelock contract will interact with
    /// @param calldatas Execution calldata for each target
    function execute(address[] memory targets, bytes[] calldata calldatas)
        public
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
        // execute a package of low level calls
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory returnData) =
                targets[i].call(calldatas[i]);
            // revert if a single call fails
            require(success == true, "call reverted");
        }
        // restore state after successful execution
        delete callTimestamps[callHash];
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
        callTimestamps[callHash] += timeValue;
        // set mapping to indicate call has been changed
        timeIncreases[callHash] = true;
    }
}
