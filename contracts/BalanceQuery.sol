// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./libraries/Authorizable.sol";
import "./interfaces/ICoreVoting.sol";
import "./interfaces/IVotingVault.sol";

contract BalanceQuery is Authorizable {
    // stores approved voting vaults
    mapping(address => bool) public approvedVaults;

    /// @notice Constructs this contract and stores needed data
    /// @param _owner The contract owner authorized to remove vaults
    constructor(address _owner) {
        // authorize the owner address to be able to remove vaults
        _authorize(_owner);
    }

    function balanceOfVault(
        address user,
        bytes calldata extraData,
        address vault
    ) external returns (uint256) {
        // check that vault is verified
        require(approvedVaults[vault], "unverified vault");

        // query the vault that we put into storage to load the users balance for each vault
        uint256 votingPower =
            IVotingVault(vault).queryVotePower(
                user,
                block.number - 1,
                extraData
            );

        // return that balance
        return votingPower;
    }

    function addVault(address vault) external onlyAuthorized {
        require(approvedVaults[vault] == false, "vault already added");
        approvedVaults[vault] = true;
    }

    function removeVault(address vault) external onlyAuthorized {
        require(
            approvedVaults[vault] == true,
            "vault already removed or does not exist"
        );
        approvedVaults[vault] = false;
    }
}
