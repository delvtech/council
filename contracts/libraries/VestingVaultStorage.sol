// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// Copy of `Storage` with modified scope to match the VestingVault requirements
// This library allows for secure storage pointers across proxy implementations
// It will return storage pointers based on a hashed name and type string.
library VestingVaultStorage {
    // This library follows a pattern which if solidity had higher level
    // type or macro support would condense quite a bit.

    // Each basic type which does not support storage locations is encoded as
    // a struct of the same name capitalized and has functions 'load' and 'set'
    // which load the data and set the data respectively.

    // All types will have a function of the form 'typename'Ptr('name') -> storage ptr
    // which will return a storage version of the type with slot which is the hash of
    // the variable name and type string. This pointer allows easy state management between
    // upgrades and overrides the default solidity storage slot system.

    // A struct which represents 1 packed storage location (Grant)
    struct Grant {
        uint128 allocation;
        uint128 withdrawn;
        uint128 created;
        uint128 expiration;
        uint128 cliff;
        uint128 latestVotingPower;
        address delegatee;
        uint256[2] range;
    }

    /// @notice Returns the storage pointer for a named mapping of address to uint256[]
    /// @param name the variable name for the pointer
    /// @return data the mapping pointer
    function mappingAddressToGrantPtr(string memory name)
        internal
        pure
        returns (mapping(address => Grant) storage data)
    {
        bytes32 typehash = keccak256("mapping(address => Grant)");
        bytes32 offset = keccak256(abi.encodePacked(typehash, name));
        assembly {
            data.slot := offset
        }
    }
}
