// SPDX-License-Identifier: Apache-2.0
// Largely based on https://github.com/delvtech/elf-contracts/blob/a6cb960896301b7562ced70a8b221f3cc964ea0a/contracts/libraries/ERC20PermitWithSupply.sol

pragma solidity ^0.8.3;

import "./ERC20Permit.sol";
import "./Authorizable.sol";

// This contract adds total supply and minting to the generic erc20
abstract contract ERC20PermitWithMint is ERC20Permit, Authorizable {
    /// @notice Initializes the erc20 contract
    /// @param name_ the value 'name' will be set to
    /// @param symbol_ the value 'symbol' will be set to
    /// @param owner_ address which has the power to mint
    constructor(
        string memory name_,
        string memory symbol_,
        address owner_
    ) ERC20Permit(name_, symbol_) {
        setOwner(owner_);
    }

    // The stored totalSupply, it equals all tokens minted - all tokens burned
    uint256 public totalSupply;

    /// @notice Allows the governance to mint
    /// @param account the account to addd tokens to
    /// @param amount the amount of tokens to add
    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }

    /// @notice This function overrides the ERC20Permit Library's _mint and causes it
    ///          to track total supply.
    /// @param account the account to addd tokens to
    /// @param amount the amount of tokens to add
    function _mint(address account, uint256 amount) internal override {
        // Increase account balance
        balanceOf[account] = balanceOf[account] + amount;
        // Increase total supply
        totalSupply += amount;
        // Emit a transfer from zero to emulate a mint
        emit Transfer(address(0), account, amount);
    }

    /// @notice Allows the governance to burn
    /// @param account the account to burn from
    /// @param amount the amount of token to burn
    function burn(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }

    /// @notice This function overrides the ERC20Permit Library's _burn to decrement total supply
    /// @param account the account to burn from
    /// @param amount the amount of token to burn
    function _burn(address account, uint256 amount) internal override {
        // Decrease user balance
        uint256 currentBalance = balanceOf[account];
        // This logic prevents a reversion if the _burn is frontrun
        if (currentBalance < amount) {
            balanceOf[account] = 0;
        } else {
            balanceOf[account] = currentBalance - amount;
        }
        // Decrease total supply
        totalSupply -= amount;
        // Emit an event tracking the burn
        emit Transfer(account, address(0), amount);
    }
}
