// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "./VestingVault.sol";

// You can come in but you can never leave
contract UnfrozenVestingVault is AbstractVestingVault {
    /// @notice Constructs the contract by passing through the the super
    /// @param _token The erc20 token to grant.
    /// @param _stale Stale block used for voting power calculations.
    constructor(IERC20 _token, uint256 _stale)
        AbstractVestingVault(_token, _stale)
    {}

    // These functions are the only way for tokens to leave the contract
    // Therefore they now revert

    /// @notice Removes a grant.
    /// @dev The manager has the power to remove a grant at any time. Any withdrawable tokens will be
    /// sent to the grant owner.
    /// @param _who The Grant owner.
    function reduceGrant(address _who, uint128 newAllocation) public {
        // load the grant
        VestingVaultStorage.Grant storage grant = _grants()[_who];

        // make sure we are only reduing the grant, not increasing
        require(newAllocation < grant.allocation, "new allocation too large");
        require(grant.withdrawn == 0, "user already withdrew");

        // update the grant allocation
        Storage.Uint256 storage unassigned = _unassigned();
        uint256 amountReduced = grant.allocation - newAllocation;
        unassigned.data += amountReduced;
        grant.allocation = newAllocation;

        // only update range bound if grant was accepted
        if (grant.range[1] > 0) {
            grant.range[1] -= amountReduced;
        }

        // update the grant voting power and the delagatees voting power
        _syncVotingPower(_who, grant);

        // delete the grant if we reduced it to zero
        if (newAllocation == 0) {
            delete _grants()[_who];
        }
    }

    /// @notice Does nothing, always reverts
    function claim() public pure override {
        revert("Frozen");
    }

    /// @notice Does nothing, always reverts
    function withdraw(uint256, address) public pure override {
        revert("Frozen");
    }
}
