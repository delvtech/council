pragma solidity ^0.8.0;

import "../CoreVoting.sol";
import "../interfaces/ITimelock.sol";

contract TestCoreVoting is CoreVoting {
    constructor(
        ITimelock _timelock,
        uint256 _baseQuorum,
        uint256 _lockDuration,
        uint256 _minProposalPower,
        address _gsc,
        address[] memory votingVaults
    )
        CoreVoting(
            _timelock,
            _baseQuorum,
            _lockDuration,
            _minProposalPower,
            _gsc,
            votingVaults
        )
    {}

    function setTimelock(ITimelock _timelock) public {
        timelock = _timelock;
    }
}
