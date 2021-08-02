// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./interfaces/IVotingVault.sol";
import "./libraries/Authorizable.sol";

contract CoreVoting is Authorizable {
    // if a function selector does not have a set quorum we use this default quorum
    uint256 public baseQuorum;

    // Assumes avg block time of 13.3 seconds. May be longer or shorter due
    // to ice ages or short term changes in hash power.
    uint256 public constant DAY_IN_BLOCKS = 6496;

    // minimum time a proposal must be active for before executing
    // Default to 3 days, this avoids weekend surprise proposals
    uint256 public lockDuration = DAY_IN_BLOCKS * 3;

    // The number of blocks after the proposal is unlocked during which
    // voting can continue. Max vote time = lockDuration + extraVoteTime
    // Default to ~5 days of blocks, ie 8 days max vote time
    uint256 public extraVoteTime = DAY_IN_BLOCKS * 5;

    // minimum amount of voting power required to submit a proposal
    uint256 public minProposalPower;

    // number of proposals created
    uint256 public proposalCount;

    // mapping of address and selector to quorum
    mapping(address => mapping(bytes4 => uint256)) private _quorums;

    /// @notice Override of the getter for the 'quorums' mapping which returns the default
    ///         quorum when the quorum is not set.
    /// @param target the contract for which the quorum is set
    /// @param functionSelector the function which is callable
    /// @return The quorum needed to pass the function at this point in time
    function quorums(address target, bytes4 functionSelector)
        public
        view
        returns (uint256)
    {
        uint256 storedQuorum = _quorums[target][functionSelector];

        if (storedQuorum == 0) {
            return baseQuorum;
        } else {
            return storedQuorum;
        }
    }

    // stores approved voting vaults
    mapping(address => bool) public approvedVaults;

    // proposal storage with the proposalID as key
    mapping(uint256 => Proposal) public proposals;

    // mapping of addresses and proposalIDs to vote struct representing
    // the voting actions taken for each proposal
    mapping(address => mapping(uint256 => Vote)) internal _votes;

    enum Ballot { YES, NO, MAYBE }

    struct Proposal {
        // hash of this proposal's intended function calls
        bytes32 proposalHash;
        // block of the proposal creation
        uint128 created;
        // timestamp when the proposal can execute
        uint128 unlock;
        // expiration time of a proposal
        uint128 expiration;
        // the quorum required for the proposal to execute
        uint128 quorum;
        // [yes, no, maybe] voting power
        uint128[3] votingPower;
    }

    struct Vote {
        // voting power of the vote
        uint128 votingPower;
        // direction of the vote
        Ballot castBallot;
    }

    event ProposalCreated(
        uint256 proposalId,
        uint256 created,
        uint256 execution,
        uint256 expiration
    );

    event ProposalExecuted(uint256 proposalId);

    /// @notice constructor
    /// @param _timelock Timelock contract.
    /// @param _baseQuorum Default quorum for all functions with no set quorum.
    /// @param _minProposalPower Minimum voting power needed to submit a proposal.
    /// @param _gsc governance steering comity contract.
    /// @param votingVaults Initial voting vaults to approve.
    constructor(
        address _timelock,
        uint256 _baseQuorum,
        uint256 _minProposalPower,
        address _gsc,
        address[] memory votingVaults
    ) Authorizable() {
        baseQuorum = _baseQuorum;
        minProposalPower = _minProposalPower;
        for (uint256 i = 0; i < votingVaults.length; i++) {
            approvedVaults[votingVaults[i]] = true;
        }
        owner = address(_timelock);
        _authorize(_gsc);
    }

    /// @notice Create a new proposal
    /// @dev all provided votingVaults must be approved vaults `approvedVaults`.
    /// @param votingVaults voting vaults to draw voting power from.
    /// @param targets list of target addresses the timelock contract will interact with.
    /// @param calldatas execution calldata for each target.
    /// @param ballot vote direction (yes, no, maybe)
    function proposal(
        address[] calldata votingVaults,
        address[] calldata targets,
        bytes[] calldata calldatas,
        Ballot ballot
    ) external {
        require(targets.length == calldatas.length, "array length mismatch");
        // the hash is only used to verify the proposal data, proposals are tracked by ID
        // so there is no need to hash with proposalCount nonce.
        bytes32 proposalHash =
            keccak256(abi.encodePacked(targets, abi.encode(calldatas)));

        // get the quorum requirement for this proposal. The quorum requirement is equal to
        // the greatest quorum item in the proposal
        uint256 quorum;
        for (uint256 i = 0; i < targets.length; i++) {
            // function selector should be the first 4 bytes of the calldata
            bytes4 selector = _getSelector(calldatas[i]);
            uint256 unitQuorum = _quorums[targets[i]][selector];

            // don't assume baseQuorum is the highest
            unitQuorum = unitQuorum == 0 ? baseQuorum : unitQuorum;
            if (unitQuorum > quorum) {
                quorum = unitQuorum;
            }
        }

        proposals[proposalCount] = Proposal(
            proposalHash,
            uint128(block.number),
            uint128(block.number + lockDuration),
            uint128(block.number + lockDuration + extraVoteTime),
            uint128(quorum),
            proposals[proposalCount].votingPower
        );

        uint256 votingPower = vote(votingVaults, proposalCount, ballot);

        // the proposal quorum is the lowest of minProposalPower and the proposal quorum
        // because it is awkward for the proposal to require more voting power than
        // the execution
        uint256 minPower =
            quorum <= minProposalPower ? quorum : minProposalPower;
        // the GSC (governance steering comity) contract does not have a voting power requirement
        // to submit a proposal
        if (!isAuthorized(msg.sender)) {
            require(votingPower >= minPower, "insufficient voting power");
        }

        emit ProposalCreated(
            proposalCount,
            block.number,
            block.number + lockDuration,
            block.number + lockDuration + extraVoteTime
        );

        proposalCount += 1;
    }

    /// @notice Votes for a new proposal.
    /// @dev all provided votingVaults must be approved vaults `approvedVaults`.
    /// Addresses can re-vote, but the previous vote's effect will be negated.
    /// @param votingVaults voting vaults to draw voting power from.
    /// @param proposalId proposal identifier.
    /// @param ballot vote direction (yes, no, maybe)
    /// @return the user's voting power
    function vote(
        address[] memory votingVaults,
        uint256 proposalId,
        Ballot ballot
    ) public returns (uint256) {
        // No votes after the vote period is over
        require(block.number <= proposals[proposalId].expiration, "Expired");

        uint128 votingPower;

        for (uint256 i = 0; i < votingVaults.length; i++) {
            // ensure there are no voting vault duplicates
            for (uint256 j = i + 1; j < votingVaults.length; j++) {
                require(votingVaults[i] != votingVaults[j], "duplicate vault");
            }
            require(approvedVaults[votingVaults[i]], "unverified vault");
            votingPower += uint128(
                IVotingVault(votingVaults[i]).queryVotePower(
                    msg.sender,
                    proposals[proposalId].created
                )
            );
        }

        // if a user has already voted, undo their previous vote.
        // NOTE: A new vote can have less voting power
        if (_votes[msg.sender][proposalId].votingPower > 0) {
            proposals[proposalId].votingPower[
                uint256(_votes[msg.sender][proposalId].castBallot)
            ] -= _votes[msg.sender][proposalId].votingPower;
        }
        _votes[msg.sender][proposalId] = Vote(votingPower, ballot);

        proposals[proposalId].votingPower[uint256(ballot)] += votingPower;
        return votingPower;
    }

    /// @notice Execute a proposal.
    /// @dev Can be called on mature under-quorum proposals to deactivate them.
    /// @param proposalId proposal identifier.
    /// @param targets list of target addresses the timelock contract will interact with.
    /// @param calldatas execution calldata for each target.
    function execute(
        uint256 proposalId,
        address[] memory targets,
        bytes[] memory calldatas
    ) external {
        require(block.number >= proposals[proposalId].unlock, "not unlocked");
        // If executed the proposal will be deleted and this will be zero
        require(proposals[proposalId].unlock != 0, "Previously executed");

        // ensure the data matches the hash
        require(
            keccak256(abi.encodePacked(targets, abi.encode(calldatas))) ==
                proposals[proposalId].proposalHash,
            "hash mismatch"
        );

        uint128[3] memory results = proposals[proposalId].votingPower;
        // if there are enough votes to meet quorum and there are more yes votes than no votes
        // then the proposal is executed
        bool passesQuorum =
            results[0] + results[1] + results[2] >=
                proposals[proposalId].quorum;
        bool majorityInFavor = results[0] > results[1];

        require(passesQuorum && majorityInFavor, "Cannot execute");

        // Execute a package of low level calls
        // SECURITY - WILL NOT REVERT IF A SINGLE CALL FAILS, PROPOSALS MUST BE CONSTRUCTED
        //            WITH THIS IN MIND
        for (uint256 i = 0; i < targets.length; i++) {
            targets[i].call(calldatas[i]);
        }
        // Notification of proposal execution
        emit ProposalExecuted(proposalId);

        // delete proposal for some gas savings,
        // Proposals are only deleted when they are actually executed, failed proposals
        // are never deleted
        delete proposals[proposalId];
    }

    /// @notice Sets a quorum for a specific address and selector.
    /// @param target Target contract address.
    /// @param selector Function selector.
    /// @param quorum Fraction to set quorum to.
    function setCustomQuorum(
        address target,
        bytes4 selector,
        uint256 quorum
    ) external onlyOwner {
        _quorums[target][selector] = quorum;
    }

    /// @notice Updates the status of a voting vault.
    /// @param vault Address of the voting vault.
    /// @param isValid True to be valid, false otherwise.
    function changeVaultStatus(address vault, bool isValid) external onlyOwner {
        approvedVaults[vault] = isValid;
    }

    /// @notice Updates the default quorum.
    /// @param quorum New base quorum.
    function setDefaultQuroum(uint256 quorum) external onlyOwner {
        baseQuorum = quorum;
    }

    /// @notice Updates the minimum voting power needed to submit a proposal.
    /// @param _minProposalPower Minimum voting power needed to submit a proposal.
    function setMinProposalPower(uint256 _minProposalPower) external onlyOwner {
        minProposalPower = _minProposalPower;
    }

    /// @notice Updates the lock duration of a proposal.
    /// @param _lockDuration New lock duration.
    function setLockDuration(uint256 _lockDuration) external onlyOwner {
        lockDuration = _lockDuration;
    }

    /// @notice Updates the extra voting period
    /// @param _extraVoteTime New extra voting time
    function changeExtraVotingTime(uint256 _extraVoteTime) external onlyOwner {
        extraVoteTime = _extraVoteTime;
    }

    /// @notice Internal helper function to get the function selector of a calldata string.
    function _getSelector(bytes memory _calldata)
        internal
        pure
        returns (bytes4 out)
    {
        assembly {
            out := and(
                mload(add(_calldata, 32)),
                0xFFFFFFFFF0000000000000000000000000000000000000000000000000000000
            )
        }
    }
}
