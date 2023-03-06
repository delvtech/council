// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "./IERC20.sol";

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

    /// @notice Removes tokens from this contract and the voting power they represent
    /// @param amount The amount of token to withdraw
    function withdraw(uint256 amount) external;

    /// @notice The token for this locking vault
    function token() external returns (IERC20);

    /// @notice Changes a user's voting power
    /// @param newDelegate The new address which gets voting power
    function changeDelegation(address newDelegate) external;
}
