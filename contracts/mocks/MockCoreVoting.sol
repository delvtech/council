// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

contract MockCoreVoting {
    // We simply allow voting vaults to be registered by any caller
    // We use this in testing the GSC contract

    mapping(address => bool) public approvedVaults;

    function setVault(address vault, bool what) external {
        approvedVaults[vault] = what;
    }
}
