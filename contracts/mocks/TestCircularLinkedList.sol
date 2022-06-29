// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/CircularLinkedList.sol";

contract TestCircularLinkedList {
    using CircularLinkedList for CircularLinkedList.CLL;

    // note this cannot be public as recursive types are not allowed
    CircularLinkedList.CLL internal _list;

    function exists() public view returns (bool) {
        return _list.exists();
    }

    function sizeOf() public view returns (uint256) {
        return _list.sizeOf();
    }

    // Push a new node before (FALSE) or after (TRUE) the head
    function push(uint256 node, bool direction) public {
        _list.push(node, direction);
    }

    // Push a new node before (FALSE) or after (TRUE) the head
    function pop(bool direction) public returns (uint256) {
        return _list.pop(direction);
    }

    function getNode(uint256 node) public view returns (uint256[2] memory) {
        return _list.getNode(node);
    }

    // Insert node `b` beside existing node `a` in direction `d`.
    function insert(
        uint256 node,
        uint256 newNode,
        bool direction
    ) public {
        _list.insert(node, newNode, direction);
    }

    // Remove node
    function remove(uint256 node) public returns (uint256) {
        return _list.remove(node);
    }
}
