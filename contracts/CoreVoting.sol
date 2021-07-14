pragma solidity ^0.8.0;

import "./interfaces/IVotingVault.sol";
import "./interfaces/ITimelock.sol";
import "./libraries/Authorizable.sol";

contract CoreVoting is Authorizable {
    // if a function selector does not have a set quorum we use this default quorum
    uint256 public baseQuorum;

    // timelock contract
    ITimelock public timelock;

    // minimum time a proposal must be active for before executing
    uint256 public lockDuration;

    // minimum amount of voting power required to submit a proposal
    uint256 public minProposalPower;

    // number of proposals created
    uint256 public proposalCount;

    // mapping of address and selector to quorum
    mapping(address => mapping(bytes4 => uint256)) public quorums;

    // stores approved voting vaults
    mapping(address => bool) internal _approvedVaults;

    // proposal storage with the proposalID as key
    mapping(uint256 => Proposal) internal _proposals;

    // mapping of addresses and proposalIDs to vote struct representing
    // the voting actions taken for each proposal
    mapping(address => mapping(uint256 => Vote)) internal _votes;

    enum Ballot { YES, NO, MAYBE }

    struct Proposal {
        // hash of this proposal's intended function calls
        bytes32 proposalHash;
        // block of the proposal creation
        uint256 created;
        // timestamp when the proposal can execute
        uint256 unlock;
        // the quorum required for the proposal to execute
        uint256 quorum;
        // bool checking if the Proposal is still active
        bool active;
        // [yes, no, maybe] voting power
        uint256[3] votingPower;
    }

    struct Vote {
        // voting power of the vote
        uint256 votingPower;
        // direction of the vote
        Ballot castBallot;
    }

    event ProposalCreated(
        uint256 proposalId,
        uint256 created,
        uint256 expiration
    );

    event ProposalExecuted(uint256 proposalId, bool passed);

    /// @dev Prevents execution if the caller is not the timelock contract
    modifier onlyTimelock() {
        require(msg.sender == address(timelock), "not timelock");
        _;
    }

    /// @notice constructor
    /// @param _timelock Timelock contract.
    /// @param _baseQuorum Default quorum for all functions with no set quorum.
    /// @param _lockDuration Minimum time a proposal must be active for before executing.
    /// @param _minProposalPower Minimum voting power needed to submit a proposal.
    /// @param _gsc governance steering comity contract.
    /// @param votingVaults Initial voting vaults to approve.
    constructor(
        ITimelock _timelock,
        uint256 _baseQuorum,
        uint256 _lockDuration,
        uint256 _minProposalPower,
        address _gsc,
        address[] memory votingVaults
    ) Authorizable() {
        timelock = _timelock;
        baseQuorum = _baseQuorum;
        lockDuration = _lockDuration;
        minProposalPower = _minProposalPower;
        for (uint256 i = 0; i < votingVaults.length; i++) {
            _approvedVaults[votingVaults[i]] = true;
        }
        owner = address(_timelock);
        _authorize(_gsc);
    }

    /// @notice Create a new proposal
    /// @dev all provided votingVaults must be approved vaults `_approvedVaults`.
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
            if (quorums[targets[i]][selector] > quorum) {
                quorum = quorums[targets[i]][selector];
            }
        }
        // if no selectors have set quorums use baseQuorum
        if (quorum == 0) {
            quorum = baseQuorum;
        }

        _proposals[proposalCount] = Proposal(
            proposalHash,
            block.number,
            block.number + lockDuration,
            quorum,
            true,
            _proposals[proposalCount].votingPower
        );

        uint256 votingPower = vote(votingVaults, proposalCount, ballot);

        // the proposal quorum is the lowest of minProposalPower and the proposal quorum
        // because it is awkward for the proposal to require more voting power than
        // the execution
        uint256 minPower =
            quorum <= minProposalPower ? quorum : minProposalPower;
        if (!isAuthorized(msg.sender)) {
            require(votingPower >= minPower, "insufficient voting power");
        }

        emit ProposalCreated(
            proposalCount,
            block.number,
            block.number + lockDuration
        );

        proposalCount += 1;
    }

    /// @notice Votes for a new proposal.
    /// @dev all provided votingVaults must be approved vaults `_approvedVaults`.
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
        uint256 votingPower;

        for (uint256 i = 0; i < votingVaults.length; i++) {
            // ensure there are no voting vault duplicates
            for (uint256 j = i + 1; j < votingVaults.length; j++) {
                require(votingVaults[i] != votingVaults[j], "duplicate vault");
            }
            require(_approvedVaults[votingVaults[i]], "unverified vault");
            votingPower += IVotingVault(votingVaults[i]).queryVotePower(
                msg.sender,
                _proposals[proposalId].created
            );
        }

        // if a user has already voted, undo their previous vote.
        // NOTE: A new vote can have less voting power
        if (_votes[msg.sender][proposalId].votingPower > 0) {
            _proposals[proposalId].votingPower[
                uint256(_votes[msg.sender][proposalId].castBallot)
            ] -= _votes[msg.sender][proposalId].votingPower;
        }
        _votes[msg.sender][proposalId] = Vote(votingPower, ballot);

        _proposals[proposalId].votingPower[uint256(ballot)] += votingPower;
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
        require(_proposals[proposalId].active, "inactive");
        require(block.number >= _proposals[proposalId].unlock, "not unlocked");
        // ensure the data matches the hash
        require(
            keccak256(abi.encodePacked(targets, abi.encode(calldatas))) ==
                _proposals[proposalId].proposalHash,
            "hash mismatch"
        );

        uint256[3] memory results = _proposals[proposalId].votingPower;
        // if there are enough votes to meet quorum and there are more yes votes than no votes
        // then the proposal is executed (submitted to the timelock)
        if (
            results[0] + results[1] + results[2] >=
            _proposals[proposalId].quorum &&
            results[0] > results[1]
        ) {
            timelock.receiveProposal(targets, calldatas);
        }

        emit ProposalExecuted(proposalId, results[0] > results[1]);

        // delete proposal for some gas savings
        delete _proposals[proposalId];
    }

    /// @notice Sets a quorum for a specific address and selector.
    /// @param target Target contract address.
    /// @param selector Function selector.
    /// @param fraction Fraction to set quorum to.
    function setCustomQuorum(
        address target,
        bytes4 selector,
        uint256 fraction
    ) external onlyTimelock {
        quorums[target][selector] = fraction;
    }

    /// @notice Updates the status of a voting vault.
    /// @param vault Address of the voting vault.
    /// @param isValid True to be valid, false otherwise.
    function changeVaultStatus(address vault, bool isValid)
        external
        onlyTimelock
    {
        _approvedVaults[vault] = isValid;
    }

    /// @notice Updates the default quorum.
    /// @param quorum New base quorum.
    function setDefaultQuroum(uint256 quorum) external onlyTimelock {
        baseQuorum = quorum;
    }

    /// @notice Updates the minimum voting power needed to submit a proposal.
    /// @param _minProposalPower Minimum voting power needed to submit a proposal.
    function setMinProposalPower(uint256 _minProposalPower)
        external
        onlyTimelock
    {
        minProposalPower = _minProposalPower;
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

    /// @notice get proposal data.
    /// @param _ptoposalID proposal identifier.
    function getProposalData(uint256 _ptoposalID)
        public
        view
        returns (
            bytes32,
            uint256,
            uint256,
            uint256,
            bool,
            uint256[3] memory
        )
    {
        return (
            _proposals[_ptoposalID].proposalHash,
            _proposals[_ptoposalID].created,
            _proposals[_ptoposalID].unlock,
            _proposals[_ptoposalID].quorum,
            _proposals[_ptoposalID].active,
            _proposals[_ptoposalID].votingPower
        );
    }
}
