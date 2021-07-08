// This contract is current a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// A contract allowing the recipients to claim the the retroactive airdrop
// Can be a close fork of the one Andy already made.

contract Airdrop {
    // We store a merkle root of the airdrop state
    // plus a mapping of who claimed
    // Plus an expiration timestamp after which the funds can be removed
    // Immutable token, and expiration
    // Changeable gov address

    constructor(
        uint256 totalAmount,
        address governance,
        bytes32 merkleRoot,
        address token,
        uint256 expiration
    ) {
        // transfers totalAmount of the token to this
        // sets immutable gov, merkle root, token, and expiration
    }

    function claim(
        bool toGovernance,
        address delegate,
        bytes32[] calldata merkleProof
    ) external {
        // Checks that this user hasn't claimed yet
        // Validates that the hash of their amount and address is in the merkle root
        // via the proof provided.
        // If they want to send their airdrop to gov send to gov
        // otherwise send to them
        // mark them as claimed
    }

    function reclaim(address destination) external {
        // checks that the calling address is gov and that the airdrop is expired
        // if expired send tokens to the destination
    }
}
