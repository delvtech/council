// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/Authorizable.sol";
import { ILockingVault } from "../interfaces/ILockingVault.sol";
import {
    SafeERC20,
    IERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract NonVotingVault is Authorizable {
    using SafeERC20 for IERC20;

    // The locking gov vault
    ILockingVault public lockingVault;
    IERC20 public immutable token;

    /// @notice Constructs this contract
    /// @param _owner The address authorized to withdraw
    /// @param _lockingVault The governance vault which this withdraws from
    constructor(address _owner, ILockingVault _lockingVault) Authorizable() {
        setOwner(_owner);
        lockingVault = _lockingVault;
        address _token = address(lockingVault.token());
        token = IERC20(_token);
        IERC20(_token).safeApprove(address(lockingVault), type(uint256).max);
    }

    /// @notice Withdraws from the locking vault
    /// @param amount The amount to withdraw
    /// @param destination The location to send the withdrawn tokens
    function withdraw(uint256 amount, address destination) external onlyOwner {
        lockingVault.withdraw(amount);
        token.safeTransfer(destination, amount);
    }
}
