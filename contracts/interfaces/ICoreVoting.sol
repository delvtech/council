// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

interface ICoreVoting {
    function approvedVaults(address) external view returns (bool);
}
