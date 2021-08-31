pragma solidity ^0.8.0;

import "../vaults/VestingVault.sol";

contract TestVestingVault is VestingVault {
    constructor(IERC20 _token, uint256 _stale) VestingVault(_token, _stale) {}

    function unassigned() public view returns (uint256) {
        return _unassigned().data;
    }

    function unvestedMultiplier() public view returns (uint256) {
        return _unvestedMultiplier().data;
    }

    function timelock() public view returns (address) {
        return _timelock().data;
    }

    function manager() public view returns (address) {
        return _manager().data;
    }
}
