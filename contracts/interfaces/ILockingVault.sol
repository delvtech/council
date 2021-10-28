// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

interface ILockingVault {
    /// @notice Deposits and delegates voting power to an address provided with the call
    /// @param fundedAccount The address to credit this deposit to
    /// @param amount The amount of token which is deposited
    /// @param firstDelegation First delegation address
    function deposit(
        address fundedAccount,
        uint256 amount,
        address firstDelegation
    ) external;
}
