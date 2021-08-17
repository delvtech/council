// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../interfaces/IVotingVault.sol";

contract MockVotingVault is IVotingVault {
    mapping(address => uint256) public votingPower;

    function setVotingPower(address _user, uint256 _amount) public {
        votingPower[_user] = _amount;
    }

    function queryVotePower(
        address _user,
        uint256 blockNumber,
        bytes calldata
    ) public view override returns (uint256) {
        blockNumber;
        return votingPower[_user];
    }
}
