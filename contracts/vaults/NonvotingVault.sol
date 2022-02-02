// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/Authorizable.sol";
import "../interfaces/ILockingVault.sol";
import "../interfaces/IERC20.sol";

contract NonvotingVault is Authorizable {
    // The locking gov vault
    ILockingVault public lockingVault;
    IERC20 public immutable token;

    /// @notice Constructs this contract
    /// @param _owner The address authorized to withdraw
    /// @param _lockingVault The governance vault which this withdraws from
    constructor(address _owner, ILockingVault _lockingVault) Authorizable() {
        setOwner(_owner);
        lockingVault = _lockingVault;
        token = lockingVault.token();
        lockingVault.token().approve(address(lockingVault), type(uint256).max);
    }

    /// @notice Withdraws from the locking vault
    /// @param amount The amount to withdraw
    /// @param destination The location to send the withdrawn tokens
    function withdraw(uint256 amount, address destination) external onlyOwner {
        lockingVault.withdraw(amount);
        token.transfer(destination, amount);
    }
}
