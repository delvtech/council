pragma solidity ^0.8.0;

import "../interfaces/ITimelock.sol";

contract MockTimelock is ITimelock {
    uint256 public proposalId;

    mapping(uint256 => Proposal) _proposals;

    struct Proposal {
        address[] targets;
        bytes[] calldatas;
    }

    function receiveProposal(address[] memory targets, bytes[] memory calldatas)
        public
        override
    {
        _proposals[proposalId] = Proposal(targets, calldatas);
        proposalId += 1;
    }

    function getTargets(uint256 _proposalId)
        public
        view
        returns (address[] memory targets)
    {
        targets = _proposals[_proposalId].targets;
    }

    function getCalldatas(uint256 _proposalId)
        public
        view
        returns (bytes[] memory calldatas)
    {
        calldatas = _proposals[_proposalId].calldatas;
    }
}
