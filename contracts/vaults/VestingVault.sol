// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../interfaces/IERC20.sol";
import "../libraries/History.sol";
import "../libraries/VestingVaultStorage.sol";
import "../libraries/Storage.sol";
import "../interfaces/IVotingVault.sol";

abstract contract AbstractVestingVault is IVotingVault {
    // Bring our libraries into scope
    using History for *;
    using VestingVaultStorage for *;
    using Storage for *;

    // NOTE: There is no emergency withdrawal, any funds not sent via deposit() are
    // unrecoverable by this version of the VestingVault

    // This contract has a privileged grant manager who can add grants or remove grants
    // It will not transfer in on each grant but rather check for solvency via state variables.

    // Immutables are in bytecode so don't need special storage treatment
    IERC20 public immutable token;

    // A constant which is how far back stale blocks are
    uint256 public immutable staleBlockLag;

    event VoteChange(address indexed to, address indexed from, int256 amount);

    /// @notice Constructs the contract.
    /// @param _token The erc20 token to grant.
    /// @param _stale Stale block used for voting power calculations.
    constructor(IERC20 _token, uint256 _stale) {
        token = _token;
        staleBlockLag = _stale;
    }

    /// @notice initialization function to set initial variables.
    /// @dev Can only be called once after deployment.
    /// @param manager_ The vault manager can add and remove grants.
    /// @param timelock_ The timelock address can change the unvested multiplier.
    function initialize(address manager_, address timelock_) public {
        require(Storage.uint256Ptr("initialized").data == 0, "initialized");
        Storage.set(Storage.uint256Ptr("initialized"), 1);
        Storage.set(Storage.addressPtr("manager"), manager_);
        Storage.set(Storage.addressPtr("timelock"), timelock_);
        Storage.set(Storage.uint256Ptr("unvestedMultiplier"), 100);
    }

    // deposits mapping(address => Grant)
    /// @notice A single function endpoint for loading grant storage
    /// @dev Only one Grant is allowed per address. Grants SHOULD NOT
    /// be modified.
    /// @return returns a storage mapping which can be used to look up grant data
    function _grants()
        internal
        pure
        returns (mapping(address => VestingVaultStorage.Grant) storage)
    {
        // This call returns a storage mapping with a unique non overwrite-able storage location
        // which can be persisted through upgrades, even if they change storage layout
        return (VestingVaultStorage.mappingAddressToGrantPtr("grants"));
    }

    /// @notice A single function endpoint for loading the starting
    /// point of the range for each accepted grant
    /// @dev This is modified any time a grant is accepted
    /// @return returns the starting point uint
    function _loadBound() internal pure returns (Storage.Uint256 memory) {
        // This call returns a storage mapping with a unique non overwrite-able storage location
        // which can be persisted through upgrades, even if they change storage layout
        return Storage.uint256Ptr("bound");
    }

    /// @notice A function to access the storage of the unassigned token value
    /// @dev The unassigned tokens are not part of any grant and ca be used
    /// for a future grant or withdrawn by the manager.
    /// @return A struct containing the unassigned uint.
    function _unassigned() internal pure returns (Storage.Uint256 storage) {
        return Storage.uint256Ptr("unassigned");
    }

    /// @notice A function to access the storage of the manager address.
    /// @dev The manager can access all functions with the onlyManager modifier.
    /// @return A struct containing the manager address.
    function _manager() internal pure returns (Storage.Address memory) {
        return Storage.addressPtr("manager");
    }

    /// @notice A function to access the storage of the timelock address
    /// @dev The timelock can access all functions with the onlyTimelock modifier.
    /// @return A struct containing the timelock address.
    function _timelock() internal pure returns (Storage.Address memory) {
        return Storage.addressPtr("timelock");
    }

    /// @notice A function to access the storage of the unvestedMultiplier value
    /// @dev The unvested multiplier is a number that represents the voting power of each
    /// unvested token as a percentage of a vested token. For example if
    /// unvested tokens have 50% voting power compared to vested ones, this value would be 50.
    /// This can be changed by governance in the future.
    /// @return A struct containing the unvestedMultiplier uint.
    function _unvestedMultiplier()
        internal
        pure
        returns (Storage.Uint256 memory)
    {
        return Storage.uint256Ptr("unvestedMultiplier");
    }

    modifier onlyManager() {
        require(msg.sender == _manager().data, "!manager");
        _;
    }

    modifier onlyTimelock() {
        require(msg.sender == _timelock().data, "!timelock");
        _;
    }

    /// @notice Getter for the grants mapping
    /// @param _who The owner of the grant to query
    /// @return Grant of the provided address
    function getGrant(address _who)
        external
        view
        returns (VestingVaultStorage.Grant memory)
    {
        return _grants()[_who];
    }

    /// @notice Accepts a grant
    /// @dev Sends token from the contract to the sender and back to the contract
    /// while assigning a numerical range to the unwithdrawn granted tokens.
    function acceptGrant() public {
        // load the grant
        VestingVaultStorage.Grant storage grant = _grants()[msg.sender];
        uint256 availableTokens = grant.allocation - grant.withdrawn;

        // check that grant has unwithdrawn tokens
        require(availableTokens > 0, "no grant available");

        // transfer the token to the user
        token.transfer(msg.sender, availableTokens);
        // transfer from the user back to the contract
        token.transferFrom(msg.sender, address(this), availableTokens);

        uint256 bound = _loadBound().data;
        grant.range = [bound, bound + availableTokens];
        Storage.set(Storage.uint256Ptr("bound"), bound + availableTokens);
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
    ) public onlyManager {
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

        // update the amount of unassigned tokens
        unassigned.data -= _amount;

        // update the delegatee's voting power
        History.HistoricalBalances memory votingPower = _votingPower();
        uint256 delegateeVotes = votingPower.loadTop(grant.delegatee);
        votingPower.push(grant.delegatee, delegateeVotes + newVotingPower);

        emit VoteChange(grant.delegatee, _who, int256(uint256(newVotingPower)));
    }

    /// @notice Removes a grant.
    /// @dev The manager has the power to remove a grant at any time. Any withdrawable tokens will be
    /// sent to the grant owner.
    /// @param _who The Grant owner.
    function removeGrant(address _who) public virtual onlyManager {
        // load the grant
        VestingVaultStorage.Grant storage grant = _grants()[_who];
        // get the amount of withdrawable tokens
        uint256 withdrawable = _getWithdrawableAmount(grant);
        // it is simpler to just transfer withdrawable tokens instead of modifying the struct storage
        // to allow withdrawal through claim()
        token.transfer(_who, withdrawable);

        Storage.Uint256 storage unassigned = _unassigned();
        uint256 locked = grant.allocation - (grant.withdrawn + withdrawable);

        // return the unused tokens so they can be used for a different grant
        unassigned.data += locked;

        // update the delegatee's voting power
        History.HistoricalBalances memory votingPower = _votingPower();
        uint256 delegateeVotes = votingPower.loadTop(grant.delegatee);
        votingPower.push(
            grant.delegatee,
            delegateeVotes - grant.latestVotingPower
        );

        // Emit the vote change event
        emit VoteChange(
            grant.delegatee,
            _who,
            -1 * int256(uint256(grant.latestVotingPower))
        );

        // delete the grant
        delete _grants()[_who];
    }

    /// @notice Claim all withdrawable value from a grant.
    /// @dev claiming value resets the voting power, This could either increase or reduce the
    /// total voting power associated with the caller's grant.
    function claim() public virtual {
        // load the grant
        VestingVaultStorage.Grant storage grant = _grants()[msg.sender];
        // get the withdrawable amount
        uint256 withdrawable = _getWithdrawableAmount(grant);

        // transfer the available amount
        token.transfer(msg.sender, withdrawable);
        grant.withdrawn += uint128(withdrawable);

        // only move range bound if grant was accepted
        if (grant.range[1] > 0) {
            grant.range[1] -= withdrawable;
        }

        // update the user's voting power
        _syncVotingPower(msg.sender, grant);
    }

    /// @notice Changes the caller's token grant voting power delegation.
    /// @dev The total voting power is not guaranteed to go up because
    /// the unvested token multiplier can be updated at any time.
    /// @param _to the address to delegate to
    function delegate(address _to) public {
        VestingVaultStorage.Grant storage grant = _grants()[msg.sender];
        // If the delegation has already happened we don't want the tx to send
        require(_to != grant.delegatee, "Already delegated");
        History.HistoricalBalances memory votingPower = _votingPower();

        uint256 oldDelegateeVotes = votingPower.loadTop(grant.delegatee);
        uint256 newVotingPower = _currentVotingPower(grant);

        // Remove old delegatee's voting power and emit event
        votingPower.push(
            grant.delegatee,
            oldDelegateeVotes - grant.latestVotingPower
        );
        emit VoteChange(
            grant.delegatee,
            msg.sender,
            -1 * int256(uint256(grant.latestVotingPower))
        );

        // Note - It is important that this is loaded here and not before the previous state change because if
        // _to == grant.delegatee and re-delegation was allowed we could be working with out of date state.
        uint256 newDelegateeVotes = votingPower.loadTop(_to);

        // add voting power to the target delegatee and emit event
        emit VoteChange(_to, msg.sender, int256(newVotingPower));
        votingPower.push(_to, newDelegateeVotes + newVotingPower);

        // update grant info
        grant.latestVotingPower = uint128(newVotingPower);
        grant.delegatee = _to;
    }

    /// @notice Manager-only token deposit function.
    /// @dev Deposited tokens are added to `_unassigned` and can be used to create grants.
    /// WARNING: This is the only way to deposit tokens into the contract. Any tokens sent
    /// via other means are not recoverable by this contract.
    /// @param _amount The amount of tokens to deposit.
    function deposit(uint256 _amount) public onlyManager {
        Storage.Uint256 storage unassigned = _unassigned();
        // update unassigned value
        unassigned.data += _amount;
        token.transferFrom(msg.sender, address(this), _amount);
    }

    /// @notice Manager-only token withdrawal function.
    /// @dev The manager can withdraw tokens that are not being used by a grant.
    /// This function cannot be used to recover tokens that were sent to this contract
    /// by any means other than `deposit()`
    /// @param _amount the amount to withdraw
    /// @param _recipient the address to withdraw to
    function withdraw(uint256 _amount, address _recipient)
        public
        virtual
        onlyManager
    {
        Storage.Uint256 storage unassigned = _unassigned();
        require(unassigned.data >= _amount, "Insufficient balance");
        // update unassigned value
        unassigned.data -= _amount;
        token.transfer(_recipient, _amount);
    }

    /// @notice Update a delegatee's voting power.
    /// @dev Voting power is only updated for this block onward.
    /// see `History` for more on how voting power is tracked and queried.
    /// Anybody can update a grant's voting power.
    /// @param _who the address who's voting power this function updates
    function updateVotingPower(address _who) public {
        VestingVaultStorage.Grant storage grant = _grants()[_who];
        _syncVotingPower(_who, grant);
    }

    /// @notice Helper to update a delegatee's voting power.
    /// @param _who the address who's voting power we need to sync
    /// @param _grant the storage pointer to the grant of that user
    function _syncVotingPower(
        address _who,
        VestingVaultStorage.Grant storage _grant
    ) internal {
        History.HistoricalBalances memory votingPower = _votingPower();

        uint256 delegateeVotes = votingPower.loadTop(_grant.delegatee);

        uint256 newVotingPower = _currentVotingPower(_grant);
        // get the change in voting power. Negative if the voting power is reduced
        int256 change =
            int256(newVotingPower) - int256(uint256(_grant.latestVotingPower));
        // do nothing if there is no change
        if (change == 0) return;
        if (change > 0) {
            votingPower.push(
                _grant.delegatee,
                delegateeVotes + uint256(change)
            );
        } else {
            // if the change is negative, we multiply by -1 to avoid underflow when casting
            votingPower.push(
                _grant.delegatee,
                delegateeVotes - uint256(change * -1)
            );
        }
        emit VoteChange(_grant.delegatee, _who, change);
        _grant.latestVotingPower = uint128(newVotingPower);
    }

    /// @notice Attempts to load the voting power of a user
    /// @param user The address we want to load the voting power of
    /// @param blockNumber the block number we want the user's voting power at
    // @param calldata the extra calldata is unused in this contract
    /// @return the number of votes
    function queryVotePower(
        address user,
        uint256 blockNumber,
        bytes calldata
    ) external override returns (uint256) {
        // Get our reference to historical data
        History.HistoricalBalances memory votingPower = _votingPower();
        // Find the historical data and clear everything more than 'staleBlockLag' into the past
        return
            votingPower.findAndClear(
                user,
                blockNumber,
                block.number - staleBlockLag
            );
    }

    /// @notice Loads the voting power of a user without changing state
    /// @param user The address we want to load the voting power of
    /// @param blockNumber the block number we want the user's voting power at
    /// @return the number of votes
    function queryVotePowerView(address user, uint256 blockNumber)
        external
        view
        returns (uint256)
    {
        // Get our reference to historical data
        History.HistoricalBalances memory votingPower = _votingPower();
        // Find the historical data
        return votingPower.find(user, blockNumber);
    }

    /// @notice Calculates how much a grantee can withdraw
    /// @param _grant the memory location of the loaded grant
    /// @return the amount which can be withdrawn
    function _getWithdrawableAmount(VestingVaultStorage.Grant memory _grant)
        internal
        view
        returns (uint256)
    {
        if (block.number < _grant.cliff || block.number < _grant.created) {
            return 0;
        }
        if (block.number >= _grant.expiration) {
            return (_grant.allocation - _grant.withdrawn);
        }
        uint256 unlocked =
            (_grant.allocation * (block.number - _grant.created)) /
                (_grant.expiration - _grant.created);
        return (unlocked - _grant.withdrawn);
    }

    /// @notice Returns the historical voting power tracker.
    /// @return A struct which can push to and find items in block indexed storage.
    function _votingPower()
        internal
        pure
        returns (History.HistoricalBalances memory)
    {
        // This call returns a storage mapping with a unique non overwrite-able storage location
        // which can be persisted through upgrades, even if they change storage layout.
        return (History.load("votingPower"));
    }

    /// @notice Helper that returns the current voting power of a grant
    /// @dev This is not always the recorded voting power since it uses the latest
    /// _unvestedMultiplier.
    /// @param _grant The grant to check for voting power.
    /// @return The current voting power of the grant.
    function _currentVotingPower(VestingVaultStorage.Grant memory _grant)
        internal
        view
        returns (uint256)
    {
        uint256 withdrawable = _getWithdrawableAmount(_grant);
        uint256 locked = _grant.allocation - (withdrawable + _grant.withdrawn);
        return (withdrawable + (locked * _unvestedMultiplier().data) / 100);
    }

    /// @notice timelock-only unvestedMultiplier update function.
    /// @dev Allows the timelock to update the unvestedMultiplier.
    /// @param _multiplier The new multiplier.
    function changeUnvestedMultiplier(uint256 _multiplier) public onlyTimelock {
        require(_multiplier <= 100, "Above 100%");
        Storage.set(Storage.uint256Ptr("unvestedMultiplier"), _multiplier);
    }

    /// @notice timelock-only timelock update function.
    /// @dev Allows the timelock to update the timelock address.
    /// @param timelock_ The new timelock.
    function setTimelock(address timelock_) public onlyTimelock {
        Storage.set(Storage.addressPtr("timelock"), timelock_);
    }

    /// @notice timelock-only manager update function.
    /// @dev Allows the timelock to update the manager address.
    /// @param manager_ The new manager.
    function setManager(address manager_) public onlyTimelock {
        Storage.set(Storage.addressPtr("manager"), manager_);
    }

    /// @notice A function to access the storage of the timelock address
    /// @dev The timelock can access all functions with the onlyTimelock modifier.
    /// @return The timelock address.
    function timelock() public pure returns (address) {
        return _timelock().data;
    }

    /// @notice A function to access the storage of the unvested token vote power multiplier.
    /// @return The unvested token multiplier
    function unvestedMultiplier() external pure returns (uint256) {
        return _unvestedMultiplier().data;
    }

    /// @notice A function to access the storage of the manager address.
    /// @dev The manager can access all functions with the olyManager modifier.
    /// @return The manager address.
    function manager() public pure returns (address) {
        return _manager().data;
    }
}

// Deployable version of the abstract contract
contract VestingVault is AbstractVestingVault {
    /// @notice Constructs the contract.
    /// @param _token The erc20 token to grant.
    /// @param _stale Stale block used for voting power calculations.
    constructor(IERC20 _token, uint256 _stale)
        AbstractVestingVault(_token, _stale)
    {}
}
