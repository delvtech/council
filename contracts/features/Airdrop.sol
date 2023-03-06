// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/Authorizable.sol";
import "../libraries/MerkleRewards.sol";

// A merkle rewards contract with an expiration time

contract Airdrop is MerkleRewards, Authorizable {
    // The time after which the token cannot be claimed
    uint256 public immutable expiration;

    /// @notice Constructs the contract and sets state and immutable variables
    /// @param _governance The address which can withdraw funds when the drop expires
    /// @param _merkleRoot The root a keccak256 merkle tree with leaves which are address amount pairs
    /// @param _token The erc20 contract which will be sent to the people with claims on the contract
    /// @param _expiration The unix second timestamp when the airdrop expires
    /// @param _lockingVault The governance vault which this deposits to on behalf of users
    constructor(
        address _governance,
        bytes32 _merkleRoot,
        IERC20 _token,
        uint256 _expiration,
        ILockingVault _lockingVault
    ) MerkleRewards(_merkleRoot, _token, _lockingVault) {
        // Set expiration immutable and governance to the owner
        expiration = _expiration;
        setOwner(_governance);
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
