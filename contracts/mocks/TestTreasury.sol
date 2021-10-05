// SPDX-License-Identifier: Apache-2.0
import "../features/Treasury.sol";

pragma solidity ^0.8.3;

// This contract is designed to hold the erc20 and eth reserves of the dao
// and will likely control a large amount of funds. It is designed to be
// flexible, secure and simple
contract TestTreasury is Treasury {
    uint256 public dummy;

    constructor(address _governance) Treasury(_governance) {}

    // function to test call forwarding
    function updateDummy(uint256 _newDummy) public {
        dummy = _newDummy;
    }
}
