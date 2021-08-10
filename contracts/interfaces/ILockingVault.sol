// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

interface ILockingVault {
    function deposit(
        address fundedAccount,
        uint256 amount,
        address firstDelegation
    ) external;
}
