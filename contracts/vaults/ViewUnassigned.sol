// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "./VestingVault.sol";
import "../libraries/VestingVaultStorage.sol";

// FOR LOCAL PURPOSES ONLY
// A simple contract that makes unassigned public so that we can view the unassigned tokens in the
// contract.  This is not meant to be deployed on mainnet, only locally.
contract ViewUnassigned is AbstractVestingVault {
    /// @notice Constructs the contract by passing through the the super
    /// @param _token The erc20 token to grant. /// @param _stale Stale block used for voting power calculations.
    constructor(
        IERC20 _token,
        uint256 _stale
    ) AbstractVestingVault(_token, _stale) {} // solhint-disable-line no-empty-blocks

    /// @notice Does nothing, always reverts
    function claim() public pure override {
        revert("Frozen");
    }

    /// @notice Does nothing, always reverts
    function withdraw(uint256, address) public pure override {
        revert("Frozen");
    }

    /// @notice A function to access the storage of the unassigned token value
    /// @dev The unassigned tokens are not part of any grant and ca be used
    /// for a future grant or withdrawn by the manager.
    /// @return unassignedTokens A struct containing the unassigned uint.
    function unassigned() public view returns (uint256 unassignedTokens) {
        return Storage.uint256Ptr("unassigned").data;
    }
}
