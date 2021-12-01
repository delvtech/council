// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../vaults/VestingVault.sol";

contract TestVestingVault is VestingVault {
    constructor(IERC20 _token, uint256 _stale) VestingVault(_token, _stale) {}

    function unassigned() public view returns (uint256) {
        return _unassigned().data;
    }
}
