// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

contract Reverter {
    function fail() external pure {
        require(false);
    }
}
