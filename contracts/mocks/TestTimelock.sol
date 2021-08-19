pragma solidity ^0.8.0;

import "../features/Timelock.sol";

contract TestTimelock is Timelock {
    // public dummy value used to test calldata calls
    uint256 public dummyValue;

    constructor(uint256 _waitTime, address _governance)
        Timelock(_waitTime, _governance)
    {}

    function updateDummy(uint256 _newValue) public {
        dummyValue = _newValue;
    }
}
