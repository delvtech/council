// SPDX-License-Identifier: Apache-2.0

// taken from our contracts repo

pragma solidity ^0.8.0;

import "../features/Spender.sol";

// Spends twice in one call
contract MockDoubleSpender {
    function doubleSpendSmall(Spender spender, uint256 amount) external {
        spender.smallSpend(amount, msg.sender);
        spender.smallSpend(amount, msg.sender);
    }

    function doubleSpendMedium(Spender spender, uint256 amount) external {
        spender.mediumSpend(amount, msg.sender);
        spender.mediumSpend(amount, msg.sender);
    }

    function doubleSpendLarge(Spender spender, uint256 amount) external {
        spender.highSpend(amount, msg.sender);
        spender.highSpend(amount, msg.sender);
    }
}
