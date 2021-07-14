pragma solidity ^0.8.0;

interface ITimelock {
    function receiveProposal(address[] calldata targets, bytes[] calldata)
        external;
}
