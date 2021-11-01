// SPDX-License-Identifier: Apache-2.0

// taken from our contracts repo

import "../libraries/ERC20PermitWithMint.sol";

pragma solidity ^0.8.0;

contract MockERC20 is ERC20PermitWithMint {
    constructor(
        string memory name_,
        string memory symbol_,
        address owner_
    ) ERC20PermitWithMint(name_, symbol_, owner_) {}

    function setBalance(address who, uint256 amount) external {
        balanceOf[who] = amount;
    }

    function setAllowance(
        address source,
        address spender,
        uint256 amount
    ) external {
        allowance[source][spender] = amount;
    }
}
