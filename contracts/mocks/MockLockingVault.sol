// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract MockLockingVault {
    mapping(address => uint256) public deposits;
    mapping(address => address) public delegation;

    function deposit(
        address fundedAccount,
        uint256 amount,
        address firstDelegation
    ) external {
        deposits[fundedAccount] += amount;
        delegation[fundedAccount] = firstDelegation;
    }
}
