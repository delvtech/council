pragma solidity ^0.8.0;

import "../vaults/VestingVault.sol";

contract TestVestingVault is VestingVault {
    constructor(
        IERC20 _token,
        uint256 _stale,
        address _manager,
        address _timelock
    ) VestingVault(_token, _stale, _manager, _timelock) {}

    function unassigned() public view returns (uint256) {
        return _unassigned().data;
    }

    function unvestedMultiplier() public view returns (uint256) {
        return _unvestedMultiplier().data;
    }
}
