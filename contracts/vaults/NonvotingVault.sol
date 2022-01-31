// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/Authorizable.sol";
import "../interfaces/ILockingVault.sol";

contract NonvotingVault is Authorizable {
    // The locking gov vault
    ILockingVault public lockingVault;

    /// @notice Constructs this contract
    /// @param _owner The address authorized to withdraw
    /// @param _lockingVault The governance vault which this withdraws from
    constructor(address _owner, ILockingVault _lockingVault) Authorizable() {
        setOwner(_owner);
        lockingVault = _lockingVault;
    }

    /// @notice Withdraws from the locking vault
    /// @param amount The amount to withdraw
    function withdraw(uint256 amount) external {
        lockingVault.withdraw(amount);
    }
}
