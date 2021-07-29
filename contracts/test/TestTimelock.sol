pragma solidity ^0.8.0;

import "../features/Timelock.sol";

contract TestTimelock is Timelock {

    constructor(
        uint256 _waitTime,
        address _self,
        bool _isGovernance
    )
    Timelock(
        _waitTime,
        _self,
        _isGovernance
    )
    {}
    
}