// This contract is currently a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// This contract is designed to hold the erc20 and eth reserves of the dao
// and will likely control a large amount of funds. It is designed to be
// flexible, secure and simple

contract Treasury {
    // Checks that the caller is the time lock contract
    modifier onlyGovernance() {
        _;
    }

    // Sends either erc20 or eth
    function sendFunds(address token, uint256 amount) external onlyGovernance {}

    // approves an erc20 spender
    function approve(
        address token,
        address spender,
        uint256 amount
    ) external onlyGovernance {}

    // preforms a generic pass through call which simply forwards calldata to a new target
    function genericCall(address toCall, bytes calldata callData)
        external
        onlyGovernance
    {}
}
