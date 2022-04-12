// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./libraries/Authorizable.sol";
import "./interfaces/ICoreVoting.sol";
import "./interfaces/IVotingVault.sol";

contract BalanceQuery is Authorizable {
    // stores approved voting vaults
    IVotingVault[] public vaults;

    /// @notice Constructs this contract and stores needed data
    /// @param _owner The contract owner authorized to remove vaults
    constructor(address _owner, address[] memory votingVaults) {
        // set the storage array of vaults
        vaults = new IVotingVault[](votingVaults.length);

        // authorize the owner address to be able to add/remove vaults
        _authorize(_owner);
    }

    function balanceOfVaults(address user) external returns (uint256) {
        uint256 votingPower = 0;
        // query voting power from each vault
        for (uint256 i = 0; i < vaults.length; i++) {
            votingPower =
                votingPower +
                vault.queryVotePower(user, block.number - 1, 0);
        }

        // return that balance
        return votingPower;
    }

    function addVault(address vault) external onlyAuthorized {
        // ?
    }

    function removeVault(address vault) external onlyAuthorized {
        for (uint256 i = 0; i < vaults.length; i++) {
            delete vault[i];
        }
    }
}
