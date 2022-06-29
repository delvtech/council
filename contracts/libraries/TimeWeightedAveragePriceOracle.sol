// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "./CircularLinkedList.sol";

abstract contract TimeWeightedAveragePriceOracle {
    uint256 public maxBufferLength;
    uint256 public windowTimeInSeconds;
    uint256 public stepSizeInSeconds;
    bool public constant PREVIOUS = false;
    bool public constant NEXT = true;

    using CircularLinkedList for CircularLinkedList.CLL;

    // note this cannot be public as recursive types are not allowed
    CircularLinkedList.CLL internal _list;

    /// @notice Initializes the TWAPOracle.
    /// @param _maxBufferLength The length of the circular buffer to record the cumulative sums
    /// @param _windowSizeInSeconds The maximum time in seconds before the buffer rolls over
    constructor(uint256 _maxBufferLength, uint256 _windowSizeInSeconds) {
        maxBufferLength = _maxBufferLength;
        windowTimeInSeconds = _windowSizeInSeconds;

        require(
            _windowSizeInSeconds % _maxBufferLength == 0,
            "maxTimeInSeconds not evenly divisible by bufferLength"
        );

        stepSizeInSeconds = _windowSizeInSeconds / _maxBufferLength;
    }

    /// @notice adds a new cumulative price to the buffer
    /// @param price the new price to be multiplied by the time elapsed since the last price recorded
    function addPriceCumulative(uint224 price) public {
        if (_list.sizeOf() < maxBufferLength) {
            uint256 previousNode = _list.step(0, PREVIOUS);
            (, uint32 previousTimestamp) = _splitSumAndTimestamp(previousNode);

            uint224 newSum =
                uint224(block.timestamp - previousTimestamp) * price;
            uint256 newNode =
                _joinSumAndTimestamp(newSum, uint32(block.timestamp));
            _list.push(newNode, PREVIOUS);
        }

        // TODO: replace node with oldest timestamp if buffer is full
    }

    /// @notice helper function to split a uint256 into its sum and timestamp components
    /// @param sumAndTimestamp the 224 MSBs are the cumulative sum and the 32 LSBs are the timestamp
    function _splitSumAndTimestamp(uint256 sumAndTimestamp)
        internal
        pure
        returns (uint224 previousSum, uint32 previousTimestamp)
    {
        previousSum = uint224(sumAndTimestamp >> 32);
        previousTimestamp = uint32(sumAndTimestamp);
    }

    /// @notice helper function to join a 224 bit sum and 32 bit timestamp into a uint256
    /// @param sum 224bit cumulative sum
    /// @param timestamp 32bit timestamp in seconds
    function _joinSumAndTimestamp(uint224 sum, uint32 timestamp)
        internal
        pure
        returns (uint256 joined)
    {
        joined = (uint256(sum) << 32) & uint256(timestamp);
    }
}
