// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "./Storage.sol";

// This library is an assembly optimized storage library which is designed
// to track timestamp history in a struct which uses hash derived pointers.
// WARNING - Developers using it should not access the underlying storage
// directly since we break some assumptions of high level solidity. Please
// note this library also increases the risk profile of memory manipulation
// please be cautious in your usage of uninitialized memory structs and other
// anti patterns.
library HistoricalBalanceTracker {
    // The storage layout of the historical array looks like this
    // [(128 bit length)(128 bit length)] [0][0] ... [(64 bit block num)(192 bit data)] .... [(64 bit block num)(192 bit data)]
    //                                                   ^ min index
    // We give the option to the invoker of the search function the ability to clear
    // stale storage. So before the min index will be zero and after the min index will be
    // currently relevant block numbs. To find data we binary search for the block number we need

    // A struct which wraps a memory pointer to a string and then derives
    // storage pointers to the data from
    // WARNING - For security purposes never directly construct this object always use load
    // TODO - Consider moving away from this caching model to reduce risk profile
    struct HistoricalBalances {
        string name;
        // Note - We use bytes32 to reduce how easy this is to manipulate in high level sol
        bytes32 cachedPointer;
    }

    /// @notice The method by which inheriting contracts init the HistoricalBalances struct
    /// @param name The name of the variable. Note - these are globals, any invocations of this
    ///             with the same name work on the same memory.
    /// @return The memory pointer
    function load(string memory name)
        internal
        pure
        returns (HistoricalBalances memory)
    {
        mapping(address => uint256[]) storage storageData =
            Storage.mappingAddressToUnit256ArrayPtr(name);
        bytes32 pointer;
        assembly {
            pointer := storageData.slot
        }
        return HistoricalBalances(name, pointer);
    }

    /// @notice An unsafe method of attaching the cached ptr in a historical balance memory objects
    /// @param pointer cached pointer to storage
    /// @return storageData A storage array mapping pointer
    /// @dev PLEASE DO NOT USE THIS METHOD WITHOUT SERIOUS REVIEW. IF AN EXTERNAL ACTOR CAN CALL THIS WITH
    //       ARBITRARY DATA THEY CAN OVERWRITE ANY STORAGE IN THE CONTRACT.
    function _load(bytes32 pointer)
        private
        pure
        returns (mapping(address => uint256[]) storage storageData)
    {
        assembly {
            storageData.slot := pointer
        }
    }

    /// @notice This function adds a block stamp indexed piece of data to a historical data array
    /// @param wrapper The wrapper which hold the reference to the historical data
    /// @param who The address which indexes the array we need to push to
    /// @param data The data to append, should be at most 192 bits and will revert if not
    function push(
        HistoricalBalances memory wrapper,
        address who,
        uint256 data
    ) internal {
        // Check preconditions
        // OoB = Out of Bounds
        require(data < uint256(1) << 192, "OoB");
        // Get the storage this is referencing
        mapping(address => uint256[]) storage storageMapping =
            _load(wrapper.cachedPointer);
        // Get the array we need to push to
        uint256[] storage storageData = storageMapping[who];
        // We load the block number and then shift it to be in the top 64 bits
        uint256 blockNumber = block.number << 192;
        // We combine it with the data, because of our require this will have a clean
        // top 64 bits
        uint256 packedData = blockNumber & data;
        // NOTE - The following is kind of a hack. We can use a vanilla storage push w/o
        //        assembly because length is the in the small bit slot of the 'length' field
        //        this means when our array.push compiles down to loading the whole field and adding 1
        //        it adds 1 to the length field but doesn't affect our minInd field.
        // Warning - this only works because of packing order, don't reverse it or risk
        //           data corruption.
        storageData.push(packedData);
    }

    /// @notice Finds the data stored with the highest block number which is less than or equal to a provided
    ///         blocknumber user.
    /// @param wrapper The memory struct which we want to search for historical data
    /// @param who The address which indexes the array to be searched
    /// @param blocknumber The blocknumber we want to load the historical data of
    /// @return The loaded unpacked data at this point in time.
    function find(
        HistoricalBalances memory wrapper,
        address who,
        uint256 blocknumber
    ) internal view returns (uint256) {
        // Get the storage this is referencing
        mapping(address => uint256[]) storage storageMapping =
            _load(wrapper.cachedPointer);
        // Get the array we need to push to
        uint256[] storage storageData = storageMapping[who];
        // Pre load the bounds
        (uint256 minIndex, uint256 length) = _loadBounds(storageData);
        // Search for the blocknumber
        (uint256 unused, uint256 loadedData) =
            _find(storageData, blocknumber, 0, minIndex, length);
        // In this function we don't have to change the stored length data
        return (loadedData);
    }

    /// @notice Finds the data stored with the highest blocknumber which is less than or equal to a provided block number
    ///         Opportunistically clears any data older than staleBlock which is possible to clear.
    /// @param wrapper The memory struct which points to the storage we want to search
    /// @param who The address which indexes the historical data we want to search
    /// @param blocknumber The blocknumber we want to load the historical state of
    /// @param staleBlock A block number which we can [but are not obligated to] delete history older than
    /// @return The loaded data
    function findAndClear(
        HistoricalBalances memory wrapper,
        address who,
        uint256 blocknumber,
        uint256 staleBlock
    ) internal returns (uint256) {
        // Get the storage this is referencing
        mapping(address => uint256[]) storage storageMapping =
            _load(wrapper.cachedPointer);
        // Get the array we need to push to
        uint256[] storage storageData = storageMapping[who];
        // Pre load the bounds
        (uint256 minIndex, uint256 length) = _loadBounds(storageData);
        // Search for the blocknumber
        (uint256 staleIndex, uint256 loadedData) =
            _find(storageData, blocknumber, staleBlock, minIndex, length);
        // We clear any data in the stale region
        // Note - Since find returns 0 if no data is found which is stale and we use > instead of >=
        //        this won't trigger if no stale data is found. Plus it won't trigger on minIndex == staleIndex
        //        == maxIndex.
        if (staleIndex > minIndex) {
            // Delete the outdated stored info
            _clear(minIndex, staleIndex, storageData);
            // Reset the array info with stale index as the new minIndex
            _setBounds(storageData, uint128(staleIndex), uint128(length));
        }
        return (loadedData);
    }

    /// @notice Searches for the data stored at the largest blocknumber index less than a provided parameter.
    ///         Allows specification of a expiration stamp and returns the greatest examined index which is
    ///         found to be older than that stamp.
    /// @param data The stored data
    /// @param blocknumber the blocknumber we want to load the historical data for.
    /// @param staleBlock The oldest block that we care about the data stored for, all previous data can be deleted
    /// @param startingMinIndex The smallest filled index in the array
    /// @param length the length of the array
    /// @return Returns the largest stale data index seen or 0 for no seen stale data and the stored data
    function _find(
        uint256[] storage data,
        uint256 blocknumber,
        uint256 staleBlock,
        uint256 startingMinIndex,
        uint256 length
    ) private view returns (uint256, uint256) {
        // Load the bounds of our binary search
        uint256 maxIndex = length - 1;
        uint256 minIndex = startingMinIndex;
        uint256 staleIndex = 0;

        // TODO - consider an optional short circuit which loads the top index and then returns purely that
        //        this might optimize for normal operating conditions.

        // We run a binary search on the block number fields in the array between
        // the minIndex and maxIndex. If we find indexes with blocknumber < staleBlock
        // we set staleIndex to them and return that data for an optional clearing step
        // in the calling function.
        while (minIndex != maxIndex) {
            // We use the ceil instead of the floor because this guarantees that
            // we pick the highest blocknumber less than or equal the requested one
            uint256 mid = maxIndex - (minIndex + maxIndex) / 2;
            // Load and unpack the data in the midpoint index
            (uint256 pastBlock, uint256 loadedData) = _loadAndUnpack(data, mid);

            //  If we've found the exact block we are looking for
            if (pastBlock == blocknumber) {
                // Then we just return the data
                return (staleIndex, loadedData);

                // Otherwise if the loaded block is smaller than the block number
            } else if (pastBlock < blocknumber) {
                // Then we first check if this is possibly a stale block
                if (pastBlock < staleBlock) {
                    // If it is we mark it for clearing
                    staleIndex = mid;
                }
                // We then repeat the search logic on the indices greater than the midpoint
                minIndex = mid;

                // In this case the pastBlock > blocknumber
            } else {
                // We then repeat the search on the indices below the midpoint
                maxIndex = mid - 1;
            }
        }

        // We load at the final index of the search
        (uint256 _pastBlock, uint256 _loadedData) =
            _loadAndUnpack(data, minIndex);
        // This will only be hit if a user has misconfigured the stale index and then
        // tried to load father into the past than has been preserved
        require(_pastBlock <= blocknumber, "Search Failure");
        return (staleIndex, _loadedData);
    }

    /// @notice
    function _clear(
        uint256 oldMin,
        uint256 newMin,
        uint256[] storage data
    ) private {
        // This function is private and trusted and should be only called by functions which ensure
        // that oldMin < newMin < length
        assembly {
            // The layout of arrays in solidity is [length][data]....[data] so this pointer is the
            // slot to write to data
            let dataLocation := add(data.slot, 1)
            // Loop through each index which is below new min and clear the storage
            // Note - Uses strict min so if given an input like oldMin = 5 newMin = 5 will be a no op
            for {
                let i := oldMin
            } lt(i, newMin) {
                i := add(i, 1)
            } {
                // store at the starting data pointer + i 256 bits of zero
                sstore(add(dataLocation, i), 0)
            }
        }
    }

    /// @notice Loads and unpacks the block number index and stored data from a data array
    /// @param data the storage array
    /// @param i the index to load and unpack
    /// @return (block number, stored data)
    function _loadAndUnpack(uint256[] storage data, uint256 i)
        private
        view
        returns (uint256, uint256)
    {
        // This function is trusted and should only be called after checking data lengths
        // we use assembly for the sload to avoid reloading length.
        uint256 loaded;
        assembly {
            loaded := sload(add(add(data.slot, 1), i))
        }
        // Unpack the packed 64 bit block number and 192 bit data field
        return (
            loaded >> 192,
            loaded &
                0x0000000000000000ffffffffffffffffffffffffffffffffffffffffffffffff
        );
    }

    /// @notice This function sets our non standard bounds data field where a normal array
    ///         would have length
    /// @param minIndex The minimum non stale index
    /// @param length The length of the storage array
    /// @param data the pointer to the storage array
    function _setBounds(
        uint256[] storage data,
        uint128 minIndex,
        uint128 length
    ) private {
        assembly {
            // Ensure data cleanliness
            let clearedLength := add(
                length,
                0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff
            )
            // We move the min index into the top 128 bits by shifting it left by 128 bits
            let minInd := shl(minIndex, 128)
            // We pack the data using binary or
            let packed := or(minInd, clearedLength)
            // We store in the packed data in the length field of this storage array
            sstore(data.slot, packed)
        }
    }

    /// @notice This function loads and unpacks our packed min index and length for our custom storage array
    /// @param data The pointer to the storage location
    /// @return minInd the first filled index in the array
    /// @return length the length of the array
    function _loadBounds(uint256[] storage data)
        private
        view
        returns (uint128 minInd, uint128 length)
    {
        // Use assembly to manually load the length storage field
        uint256 packedData;
        assembly {
            packedData := sload(data.slot)
        }
        // We use a shift right to clear out the low order bits of the data field
        minInd = uint128(packedData >> 128);
        // We use a binary and to extract only the bottom 128 bits
        length = uint128(
            packedData &
                0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff
        );
    }
}
