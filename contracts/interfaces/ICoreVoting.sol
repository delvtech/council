// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

interface ICoreVoting {
    /// @notice A method auto generated from a public storage mapping, looks
    ///         up which vault addresses are approved by core voting
    /// @param vault the address to check if it is an approved vault
    /// @return true if approved false if not approved
    function approvedVaults(address vault) external view returns (bool);
}
