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

    /// @notice Adds a new grant.
    /// @dev Manager can set who the voting power will be delegated to initially.
    /// This potentially avoids the need for a delegation transaction by the grant recipient.
    /// @param _who The Grant recipient.
    /// @param _amount The total grant value.
    /// @param _startTime Optionally set a non standard start time. If set to zero then the start time
    ///                   will be made the block this is executed in.
    /// @param _expiration timestamp when the grant ends (all tokens count as unlocked).
    /// @param _cliff Timestamp when the cliff ends. No tokens are unlocked until this
    /// timestamp is reached.
    /// @param _delegatee Optional param. The address to delegate the voting power
    /// associated with this grant to
    function addGrantAndDelegate(
        address _who,
        uint128 _amount,
        uint128 _startTime,
        uint128 _expiration,
        uint128 _cliff,
        address _delegatee
    ) public override {
        // Consistency check
        require(
            _cliff <= _expiration && _startTime <= _expiration,
            "Invalid configuration"
        );
        // If no custom start time is needed we use this block.
        if (_startTime == 0) {
            _startTime = uint128(block.number);
        }

        Storage.Uint256 storage unassigned = _unassigned();
        Storage.Uint256 memory unvestedMultiplier = _unvestedMultiplier();

        require(unassigned.data >= _amount, "Insufficient balance");
        // load the grant.
        VestingVaultStorage.Grant storage grant = _grants()[_who];

        // If this address already has a grant, a different address must be provided
        // topping up or editing active grants is not supported.
        require(grant.allocation == 0, "Has Grant");

        // load the delegate. Defaults to the grant owner
        _delegatee = _delegatee == address(0) ? _who : _delegatee;

        // calculate the voting power. Assumes all voting power is initially locked.
        // Come back to this assumption.
        uint128 newVotingPower =
            (_amount * uint128(unvestedMultiplier.data)) / 100;

        // set the new grant
        _grants()[_who] = VestingVaultStorage.Grant(
            _amount,
            0,
            _startTime,
            _expiration,
            _cliff,
            newVotingPower,
            _delegatee,
            [uint256(0), uint256(0)]
        );
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
