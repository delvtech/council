// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/ILockingVault.sol";

abstract contract AbstractMerkleRewards {
    // The merkle root with deposits encoded into it as hash [address, amount]
    // Assumed to be a node sorted tree
    bytes32 public rewardsRoot;
    // The token to pay out
    IERC20 public immutable token;
    // The historic user claims
    mapping(address => uint256) public claimed;
    // The locking gov vault
    ILockingVault public lockingVault;

    /// @notice Constructs the contract and sets state and immutable variables
    /// @param _rewardsRoot The root a keccak256 merkle tree with leaves which are address amount pairs
    /// @param _token The erc20 contract which will be sent to the people with claims on the contract
    /// @param _lockingVault The governance vault which this deposits to on behalf of users
    constructor(
        bytes32 _rewardsRoot,
        IERC20 _token,
        ILockingVault _lockingVault
    ) {
        rewardsRoot = _rewardsRoot;
        token = _token;
        lockingVault = _lockingVault;
        // We approve the locking vault so that it we can deposit on behalf of users
        _token.approve(address(lockingVault), type(uint256).max);
    }

    /// @notice Claims an amount of tokens which are in the tree and moves them directly into
    ///         governance
    /// @param amount The amount of tokens to claim
    /// @param delegate The address the user will delegate to, WARNING - should not be zero
    /// @param totalGrant The total amount of tokens the user was granted
    /// @param merkleProof The merkle de-commitment which proves the user is in the merkle root
    /// @param destination The address which will be credited with funds
    function claimAndDelegate(
        uint256 amount,
        address delegate,
        uint256 totalGrant,
        bytes32[] calldata merkleProof,
        address destination
    ) external {
        // No delegating to zero
        require(delegate != address(0), "Zero addr delegation");
        // Validate the withdraw
        _validateWithdraw(amount, totalGrant, merkleProof);
        // Deposit for this sender into governance locking vault
        lockingVault.deposit(destination, amount, delegate);
    }

    /// @notice Claims an amount of tokens which are in the tree and send them to the user
    /// @param amount The amount of tokens to claim
    /// @param totalGrant The total amount of tokens the user was granted
    /// @param merkleProof The merkle de-commitment which proves the user is in the merkle root
    /// @param destination The address which will be credited with funds
    function claim(
        uint256 amount,
        uint256 totalGrant,
        bytes32[] calldata merkleProof,
        address destination
    ) external virtual {
        // Validate the withdraw
        _validateWithdraw(amount, totalGrant, merkleProof);
        // Transfer to the user
        token.transfer(destination, amount);
    }

    /// @notice Validate a withdraw attempt by checking merkle proof and ensuring the user has not
    ///         previously withdrawn
    /// @param amount The amount of tokens being claimed
    /// @param totalGrant The total amount of tokens the user was granted
    /// @param merkleProof The merkle de-commitment which proves the user is in the merkle root
    function _validateWithdraw(
        uint256 amount,
        uint256 totalGrant,
        bytes32[] memory merkleProof
    ) internal {
        // Hash the user plus the total grant amount
        bytes32 leafHash = keccak256(abi.encodePacked(msg.sender, totalGrant));

        // Verify the proof for this leaf
        require(
            MerkleProof.verify(merkleProof, rewardsRoot, leafHash),
            "Invalid Proof"
        );
        // Check that this claim won't give them more than the total grant then
        // increase the stored claim amount
        require(claimed[msg.sender] + amount <= totalGrant, "Claimed too much");
        claimed[msg.sender] += amount;
    }
}

// Deployable version of the abstract
contract MerkleRewards is AbstractMerkleRewards {
    /// @notice Constructs the contract and sets state and immutable variables
    /// @param _rewardsRoot The root a keccak256 merkle tree with leaves which are address amount pairs
    /// @param _token The erc20 contract which will be sent to the people with claims on the contract
    /// @param _lockingVault The governance vault which this deposits to on behalf of users
    constructor(
        bytes32 _rewardsRoot,
        IERC20 _token,
        ILockingVault _lockingVault
    ) AbstractMerkleRewards(_rewardsRoot, _token, _lockingVault) {}
}
