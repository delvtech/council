// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// Original code for this linked list can be found at:
// https://github.com/o0ragman0o/LibCLL/blob/master/LibCLL.sol
// The orginal file was written for solidity version 0.4.1, this is an updated
// version for 0.8.3

library CircularLinkedList {
    uint256 public constant NULL = 0;
    uint256 public constant HEAD = 0;
    bool public constant PREV = false;
    bool public constant NEXT = true;

    struct CLL {
        mapping(uint256 => mapping(bool => uint256)) cll;
    }

    // n: node id  d: direction  r: return node id

    // Return existential state of a list.
    function exists(CLL storage self) internal view returns (bool) {
        if (self.cll[HEAD][PREV] != HEAD || self.cll[HEAD][NEXT] != HEAD) {
            return true;
        }
        return false;
    }

    // Returns the number of elements in the list
    function sizeOf(CLL storage self) internal view returns (uint256 result) {
        uint256 i = step(self, HEAD, NEXT);
        while (i != HEAD) {
            i = step(self, i, NEXT);
            result++;
        }
        return result;
    }

    // Returns the links of a node as an array
    function getNode(CLL storage self, uint256 node)
        internal
        view
        returns (uint256[2] memory)
    {
        return [self.cll[node][PREV], self.cll[node][NEXT]];
    }

    // Returns the link of a node in a direction
    function step(
        CLL storage self,
        uint256 node,
        bool direction
    ) internal view returns (uint256) {
        return self.cll[node][direction];
    }

    // Can be used before `insert` to build an ordered list
    // `startValue` an existing node to search from, e.g. HEAD.
    // `value` value to seek
    // `result` first node beyond `toNode` in direction `direction`
    function seek(
        CLL storage self,
        uint256 startNode,
        uint256 node,
        bool direction
    ) internal view returns (uint256 result) {
        result = step(self, startNode, direction);
        while ((node != result) && ((node < result) != direction))
            result = self.cll[result][direction];
        return result;
    }

    // Creates a bidirectional link between two nodes on direction `d`
    function stitch(
        CLL storage self,
        uint256 firstNode,
        uint256 secondNode,
        bool direction
    ) internal {
        self.cll[secondNode][!direction] = firstNode;
        self.cll[firstNode][direction] = secondNode;
    }

    // Insert node `newNode` between existing node `node` and 'otherNode' in direction `direction`.
    function insert(
        CLL storage self,
        uint256 node,
        uint256 newNode,
        bool direction
    ) internal {
        uint256 otherNode = self.cll[node][direction];
        stitch(self, node, newNode, direction);
        stitch(self, newNode, otherNode, direction);
    }

    // Remove node, returns the node that was removed
    function remove(CLL storage self, uint256 node) internal returns (uint256) {
        if (node == NULL) {
            return NULL;
        }
        stitch(self, self.cll[node][PREV], self.cll[node][NEXT], NEXT);
        delete self.cll[node][PREV];
        delete self.cll[node][NEXT];
        return node;
    }

    // Push a new node before (FALSE) or after (TRUE) the head
    function push(
        CLL storage self,
        uint256 node,
        bool direction
    ) internal {
        insert(self, HEAD, node, direction);
    }

    // Pop a new node from before or after the head, returns
    function pop(CLL storage self, bool direction) internal returns (uint256) {
        return remove(self, step(self, HEAD, direction));
    }
}
