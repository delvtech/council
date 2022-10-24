// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/History.sol";
import "../libraries/Storage.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IVotingVault.sol";
import "../interfaces/ILockingVault.sol";

abstract contract AbstractLockingVault is IVotingVault, ILockingVault {
    // Bring our libraries into scope
    using History for *;
    using Storage for *;

    // Immutables are in bytecode so don't need special storage treatment
    IERC20 public immutable override token;
    // A constant which is how far back stale blocks are
    uint256 public immutable staleBlockLag;

    // Event to track delegation data
    event VoteChange(address indexed from, address indexed to, int256 amount);

    /// @notice Constructs the contract by setting immutables
    /// @param _token The external erc20 token contract
    /// @param _staleBlockLag The number of blocks before the delegation history is forgotten
    constructor(IERC20 _token, uint256 _staleBlockLag) {
        token = _token;
        staleBlockLag = _staleBlockLag;
    }

    // This contract is a proxy so we use the custom state management system from
    // storage and return the following as methods to isolate that call.

    // deposits mapping(address => (address, uint96))
    /// @notice A single function endpoint for loading storage for deposits
    /// @return returns a storage mapping which can be used to look up deposit data
    function _deposits()
        internal
        pure
        returns (mapping(address => Storage.AddressUint) storage)
    {
        // This call returns a storage mapping with a unique non overwrite-able storage location
        // which can be persisted through upgrades, even if they change storage layout
        return (Storage.mappingAddressToPackedAddressUint("deposits"));
    }

    /// Getter for the deposits mapping
    /// @param who The user to query the balance of
    /// @return (address delegated to, amount of deposit)
    function deposits(address who) external view returns (address, uint96) {
        Storage.AddressUint storage userData = _deposits()[who];
        return (userData.who, userData.amount);
    }

    /// @notice Returns the historical voting power tracker
    /// @return A struct which can push to and find items in block indexed storage
    function _votingPower()
        internal
        pure
        returns (History.HistoricalBalances memory)
    {
        // This call returns a storage mapping with a unique non overwrite-able storage location
        // which can be persisted through upgrades, even if they change storage layout
        return (History.load("votingPower"));
    }

    /// @notice Attempts to load the voting power of a user
    /// @param user The address we want to load the voting power of
    /// @param blockNumber the block number we want the user's voting power at
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
        // Find the historical datum
        return votingPower.find(user, blockNumber);
    }

    /// @notice Deposits and delegates voting power to an address provided with the call
    /// @param fundedAccount The address to credit this deposit to
    /// @param amount The amount of token which is deposited
    /// @param firstDelegation First delegation address
    /// @dev Note - There's a minor griefing attack on this which sets someones delegation
    ///      address by depositing before them, requiring them to call delegate to reset it.
    ///      Given the gas price required and 0 financial benefit we consider it unlikely.
    ///      Warning - Users should not set delegation to the zero address as this will allow
    ///                someone to change their delegation by depositing a small amount to their
    ///                account.
    function deposit(
        address fundedAccount,
        uint256 amount,
        address firstDelegation
    ) external override {
        // No delegating to zero
        require(firstDelegation != address(0), "Zero addr delegation");
        // Move the tokens into this contract
        token.transferFrom(msg.sender, address(this), amount);
        // Load our deposits storage
        Storage.AddressUint storage userData = _deposits()[fundedAccount];
        // Load who has the user's votes
        address delegate = userData.who;

        if (delegate == address(0)) {
            // If the user is un-delegated we delegate to their indicated address
            delegate = firstDelegation;
            // Set the delegation
            userData.who = delegate;
            // Now we increase the user's balance
            userData.amount += uint96(amount);
        } else {
            // In this case we make no change to the user's delegation
            // Now we increase the user's balance
            userData.amount += uint96(amount);
        }
        // Next we increase the delegation to their delegate
        // Get the storage pointer
        History.HistoricalBalances memory votingPower = _votingPower();
        // Load the most recent voter power stamp
        uint256 delegateeVotes = votingPower.loadTop(delegate);
        // Emit an event to track votes
        emit VoteChange(fundedAccount, delegate, int256(amount));
        // Add the newly deposited votes to the delegate
        votingPower.push(delegate, delegateeVotes + amount);
    }

    /// @notice Removes tokens from this contract and the voting power they represent
    /// @param amount The amount of token to withdraw
    function withdraw(uint256 amount) external virtual override {
        // Load our deposits storage
        Storage.AddressUint storage userData = _deposits()[msg.sender];
        // Reduce the user's stored balance
        // If properly optimized this block should result in 1 sload 1 store
        userData.amount -= uint96(amount);
        address delegate = userData.who;
        // Reduce the delegate voting power
        // Get the storage pointer
        History.HistoricalBalances memory votingPower = _votingPower();
        // Load the most recent voter power stamp
        uint256 delegateeVotes = votingPower.loadTop(delegate);
        // remove the votes from the delegate
        votingPower.push(delegate, delegateeVotes - amount);
        // Emit an event to track votes
        emit VoteChange(msg.sender, delegate, -1 * int256(amount));
        // Transfers the result to the sender
        token.transfer(msg.sender, amount);
    }

    /// @notice Changes a user's voting power
    /// @param newDelegate The new address which gets voting power
    function changeDelegation(address newDelegate) external override {
        // Get the stored user data
        Storage.AddressUint storage userData = _deposits()[msg.sender];
        // Get the user balance
        uint256 userBalance = uint256(userData.amount);
        address oldDelegate = userData.who;
        // Reset the user delegation
        userData.who = newDelegate;
        // Reduce the old voting power
        // Get the storage pointer
        History.HistoricalBalances memory votingPower = _votingPower();
        // Load the old delegate's voting power
        uint256 oldDelegateVotes = votingPower.loadTop(oldDelegate);
        // Reduce the old voting power
        votingPower.push(oldDelegate, oldDelegateVotes - userBalance);
        // Emit an event to track votes
        emit VoteChange(msg.sender, oldDelegate, -1 * int256(userBalance));
        // Get the new delegate's votes
        uint256 newDelegateVotes = votingPower.loadTop(newDelegate);
        // Store the increase in power
        votingPower.push(newDelegate, newDelegateVotes + userBalance);
        // Emit an event tracking this voting power change
        emit VoteChange(msg.sender, newDelegate, int256(userBalance));
    }
}

contract LockingVault is AbstractLockingVault {
    /// @notice Constructs the contract by setting immutables
    /// @param _token The external erc20 token contract
    /// @param _staleBlockLag The number of blocks before the delegation history is forgotten
    constructor(IERC20 _token, uint256 _staleBlockLag)
        AbstractLockingVault(_token, _staleBlockLag)
    {}
}
