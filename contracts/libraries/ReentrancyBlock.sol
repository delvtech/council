// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

contract ReentrancyBlock {
    // A storage slot for the reentrancy flag
    bool entered;
    // Will use a state flag to prevent this function from being called back into
    modifier nonReentrant() {
        // Check the state variable before the call is entered
        require(!entered, "Reentrancy");
        // Store that the function has been entered
        entered = true;
        // Run the function code
        _;
        // Clear the state
        entered = false;
    }
}
