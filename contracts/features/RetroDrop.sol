// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../interfaces/IERC20.sol";
import "../libraries/Authorizable.sol";
import "../interfaces/ILockingVault.sol";

contract Airdrop is Authorizable {
    // The merkle root with deposits encoded into it as hash [address, amount]
    // Assumed to be a node sorted tree
    bytes32 public immutable merkleRoot;
    // The token to pay out
    IERC20 public immutable token;
    // The time after which the token cannot be claimed
    uint256 public immutable expiration;
    // The historic user claims
    mapping(address => uint256) public claimed;
    // The locking gov vault
    ILockingVault public lockingVault;

    /// @notice Constructs the contract and sets state and immutable variables
    /// @param _governance The address which can withdraw funds when the drop expires
    /// @param _merkleRoot The root a keccak256 merkle tree with leaves which are address amount pairs
    /// @param _token The erc20 contract which will be sent to the people with claims on the contract
    /// @param _expiration The unix second timestamp when the airdrop expires
    constructor(
        address _governance,
        bytes32 _merkleRoot,
        IERC20 _token,
        uint256 _expiration,
        ILockingVault _lockingVault
    ) {
        merkleRoot = _merkleRoot;
        token = _token;
        expiration = _expiration;
        lockingVault = _lockingVault;
        setOwner(_governance);
        // We approve the locking vault so that it we can deposit on behalf of users
        _token.approve(address(lockingVault), type(uint256).max);
    }

    /// @notice Claims an amount of tokens which are in the tree and moves them directly into
    ///         governance
    /// @param amount The amount of tokens to claim
    /// @param delegate The address the user will delegate to, WARNING - should not be zero
    /// @param totalGrant The total amount of tokens the user was granted
    /// @param merkleProof The merkle de-commitment which proves the user is in the merkle root
    function claimAndDelegate(
        uint256 amount,
        address delegate,
        uint256 totalGrant,
        bytes32[] calldata merkleProof
    ) external {
        // Validate the withdraw
        _validateWithdraw(amount, totalGrant, merkleProof);
        // Deposit for this sender into governance locking vault
        lockingVault.deposit(msg.sender, amount, delegate);
    }

    /// @notice Claims an amount of tokens which are in the tree and send them to the user
    /// @param amount The amount of tokens to claim
    /// @param totalGrant The total amount of tokens the user was granted
    /// @param merkleProof The merkle de-commitment which proves the user is in the merkle root
    function claim(
        uint256 amount,
        uint256 totalGrant,
        bytes32[] calldata merkleProof
    ) external {
        // Validate the withdraw
        _validateWithdraw(amount, totalGrant, merkleProof);
        // Transfer to the user
        token.transfer(msg.sender, amount);
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
            MerkleProof.verify(merkleProof, merkleRoot, leafHash),
            "Invalid Proof"
        );
        // Check that this claim won't give them more than the total grant then
        // increase the stored claim amount
        require(claimed[msg.sender] + amount <= totalGrant, "Claimed too much");
        claimed[msg.sender] += amount;
    }

    /// @notice Allows governance to remove the funds in this contract once the airdrop is over.
    ///         Claims aren't blocked the airdrop ending at expiration is optional and gov has to
    ///         manually end it.
    /// @param destination The treasury contract which will hold the freed tokens
    function reclaim(address destination) external onlyOwner {
        require(block.timestamp > expiration, "Not expired");
        uint256 unclaimed = token.balanceOf(address(this));
        token.transfer(destination, unclaimed);
    }
}
