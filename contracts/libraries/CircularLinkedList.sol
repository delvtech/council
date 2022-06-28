// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

// Original code for this linked list can be found at:
// https://github.com/o0ragman0o/LibCLL/blob/master/LibCLL.sol
// The orginal file was written for solidity version 0.4.1, this is an updated
// version for 0.8.3

library LibCLLu {
    bytes32 public constant VERSION = "LibCLLu 0.4.1";
    uint256 constant NULL = 0;
    uint256 constant HEAD = 0;
    bool constant PREV = false;
    bool constant NEXT = true;

    struct CLL {
        mapping(uint256 => mapping(bool => uint256)) cll;
    }

    // n: node id  d: direction  r: return node id

    // Return existential state of a list.
    function exists(CLL storage self) internal view returns (bool) {
        if (self.cll[HEAD][PREV] != HEAD || self.cll[HEAD][NEXT] != HEAD)
            return true;
    }

    // Returns the number of elements in the list
    function sizeOf(CLL storage self) internal view returns (uint256 r) {
        uint256 i = step(self, HEAD, NEXT);
        while (i != HEAD) {
            i = step(self, i, NEXT);
            r++;
        }
        return;
    }

    // Returns the links of a node as and array
    function getNode(CLL storage self, uint256 n)
        internal
        view
        returns (uint256[2])
    {
        return [self.cll[n][PREV], self.cll[n][NEXT]];
    }

    // Returns the link of a node `n` in direction `d`.
    function step(
        CLL storage self,
        uint256 n,
        bool d
    ) internal view returns (uint256) {
        return self.cll[n][d];
    }

    // Can be used before `insert` to build an ordered list
    // `a` an existing node to search from, e.g. HEAD.
    // `b` value to seek
    // `r` first node beyond `b` in direction `d`
    function seek(
        CLL storage self,
        uint256 a,
        uint256 b,
        bool d
    ) internal view returns (uint256 r) {
        r = step(self, a, d);
        while ((b != r) && ((b < r) != d)) r = self.cll[r][d];
        return;
    }

    // Creates a bidirectional link between two nodes on direction `d`
    function stitch(
        CLL storage self,
        uint256 a,
        uint256 b,
        bool d
    ) internal {
        self.cll[b][!d] = a;
        self.cll[a][d] = b;
    }

    // Insert node `b` beside existing node `a` in direction `d`.
    function insert(
        CLL storage self,
        uint256 a,
        uint256 b,
        bool d
    ) internal {
        uint256 c = self.cll[a][d];
        stitch(self, a, b, d);
        stitch(self, b, c, d);
    }

    // Remove node
    function remove(CLL storage self, uint256 n) internal returns (uint256) {
        if (n == NULL) return;
        stitch(self, self.cll[n][PREV], self.cll[n][NEXT], NEXT);
        delete self.cll[n][PREV];
        delete self.cll[n][NEXT];
        return n;
    }

    // Push a new node before or after the head
    function push(
        CLL storage self,
        uint256 n,
        bool d
    ) internal {
        insert(self, HEAD, n, d);
    }

    // Pop a new node from before or after the head
    function pop(CLL storage self, bool d) internal returns (uint256) {
        return remove(self, step(self, HEAD, d));
    }
}
