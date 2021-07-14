pragma solidity ^0.8.0;

interface IVotingVault {
    function queryVotePower(address user, uint256 blockNumber)
        external
        returns (uint256);
}
