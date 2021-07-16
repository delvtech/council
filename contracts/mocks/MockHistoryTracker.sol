// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/History.sol";

// This contract is designed to let us test the storage and search on arrays
// in the historical balance tracking lib. Most patterns in this lib are
// anti patterns which should not be emulated in live systems since they
// break the abstraction layer between this contract and the lib.
contract MockHistoryTracker {
    // Bring the internal library methods into scope for the the memory pointer
    using History for History.HistoricalBalances;

    // A random [ish] testing address to index the array
    address constant _presetUser = 0x829BD824B016326A401d083B33D092293333A830;

    function peekArrayData(uint256 start, uint256 end)
        external
        view
        returns (uint256[] memory, uint256[] memory)
    {
        History.HistoricalBalances memory balances = History.load("balances");
        uint256[] storage balancesArray =
            _load(balances.cachedPointer)[_presetUser];

        uint256[] memory blockNumbers = new uint256[](end - start);
        uint256[] memory storedData = new uint256[](end - start);
        uint256 adjustedInd = 0;
        for (uint256 i = start; i < end; i++) {
            (uint256 blocknumber, uint256 loadedData) =
                _loadAndUnpack(balancesArray, i);
            blockNumbers[adjustedInd] = blocknumber;
            storedData[adjustedInd] = loadedData;
            adjustedInd++;
        }

        return (blockNumbers, storedData);
    }

    // Externally accessible versions of functions in

    function push(uint256 data) external {
        History.HistoricalBalances memory balances = History.load("balances");
        balances.push(_presetUser, data);
    }

    function multiPush(uint256[] calldata toBePushed) external {
        History.HistoricalBalances memory balances = History.load("balances");

        for (uint256 i = 0; i < toBePushed.length; i++) {
            balances.push(_presetUser, toBePushed[i]);
        }
    }

    function find(uint256 which) external view returns (uint256) {
        History.HistoricalBalances memory balances = History.load("balances");
        return balances.find(_presetUser, which);
    }

    function findAndClear(uint256 which, uint256 stale)
        external
        returns (uint256)
    {
        History.HistoricalBalances memory balances = History.load("balances");
        return balances.findAndClear(_presetUser, which, stale);
    }

    function loadBounds() external view returns (uint256, uint256) {
        History.HistoricalBalances memory balances = History.load("balances");
        uint256[] storage balancesArray =
            _load(balances.cachedPointer)[_presetUser];

        return _loadBounds(balancesArray);
    }

    function clear(uint256 newMin) external {
        History.HistoricalBalances memory balances = History.load("balances");
        uint256[] storage balancesArray =
            _load(balances.cachedPointer)[_presetUser];

        (uint256 oldMin, uint256 length) = _loadBounds(balancesArray);
        if (newMin > oldMin) {
            _clear(oldMin, newMin, balancesArray);
            _setBounds(balancesArray, newMin, length);
        } else {
            revert("Clear out of bounds");
        }
    }

    function loadTop() external view returns (uint256) {
        History.HistoricalBalances memory balances = History.load("balances");
        return (balances.loadTop(_presetUser));
    }

    // Copy of methods from History because inheritance of private methods is
    // impossible.

    function _load(bytes32 pointer)
        private
        pure
        returns (mapping(address => uint256[]) storage storageData)
    {
        assembly {
            storageData.slot := pointer
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

    /// @notice This function loads and unpacks our packed min index and length for our custom storage array
    /// @param data The pointer to the storage location
    /// @return minInd the first filled index in the array
    /// @return length the length of the array
    function _loadBounds(uint256[] storage data)
        private
        view
        returns (uint256 minInd, uint256 length)
    {
        // Use assembly to manually load the length storage field
        uint256 packedData;
        assembly {
            packedData := sload(data.slot)
        }
        // We use a shift right to clear out the low order bits of the data field
        minInd = packedData >> 128;
        // We use a binary and to extract only the bottom 128 bits
        length =
            packedData &
            0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff;
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

    /// @notice This function sets our non standard bounds data field where a normal array
    ///         would have length
    /// @param minIndex The minimum non stale index
    /// @param length The length of the storage array
    /// @param data the pointer to the storage array
    function _setBounds(
        uint256[] storage data,
        uint256 minIndex,
        uint256 length
    ) private {
        assembly {
            // Ensure data cleanliness
            let clearedLength := and(
                length,
                0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff
            )
            // We move the min index into the top 128 bits by shifting it left by 128 bits
            let minInd := shl(128, minIndex)
            // We pack the data using binary or
            let packed := or(minInd, clearedLength)
            // We store in the packed data in the length field of this storage array
            sstore(data.slot, packed)
        }
    }
}
