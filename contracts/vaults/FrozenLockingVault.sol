// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "./LockingVault.sol";

// All elves stay in the elfiverse
contract FrozenLockingVault is AbstractLockingVault {
    /// @notice Constructs the contract by setting immutables
    /// @param _token The external erc20 token contract
    /// @param _staleBlockLag The number of blocks before the delegation history is forgotten
    constructor(IERC20 _token, uint256 _staleBlockLag)
        AbstractLockingVault(_token, _staleBlockLag)
    {}

    // These functions are the only way for tokens to leave the contract
    // Therefore they now revert

    /// @notice Does nothing, always reverts
    function withdraw(uint256) external pure override {
        revert("Frozen");
    }
}
