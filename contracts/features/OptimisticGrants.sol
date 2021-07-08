// This contract is current a scaffold, meaning it is unimplemented and
// just designed to show the shape of future code. The naming and other
// conventions are 'soft' and more of suggestions that the implementer
// has full ability to change. Changes which break interface compatibility though
// should be double checked with the rest of the team.

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// A funded contract which can transfer token to a user after a time period
// during that time the grant is recallable for non performance.

contract OptimisticGrants {
    // Checks that the caller is the governance contract
    modifier onlyGovernance() {
        _;
    }

    // Either creates a new grant or overrides the data
    // To remove a grant amount = 0, deadline = 0 for grant which has already been created
    function configureGrant(
        uint256 amount,
        address spender,
        uint256 deadline
    ) external onlyGovernance {}

    // Load's msg.senders grant and then sends the amount of token to them if unlocked
    // reverts if not unlocked
    function claimGrant() external {}
}
