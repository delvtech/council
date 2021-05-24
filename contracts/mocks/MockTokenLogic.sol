pragma solidity ^0.8.0;

import "../libraries/Storage.sol";
import "./StorageRead.sol";

contract MockTokenLogic is ReadAndWriteAnyStorage {
    // This contract is an implementation target for the proxy so uses the
    // proxy storage lib for safe portable slotting cross upgrades.
    using Storage for *;

    // We don't declare them but the following are our state variables
    // uint256 totalSupply
    // address owner
    // mapping(address => balance) balances
    // Access functions which prevent us from typo-ing the variable name below
    function getOwner() internal pure returns(Storage.Address storage) {
        return Storage.addressPtr("owner");
    }
    function getTotalSupply() internal pure returns(Storage.Uint256 storage) {
        return Storage.uint256Ptr("totalSupply");
    }
    function getBalancesMapping() internal pure returns(mapping(address => uint256) storage) {
        return Storage.mappingAddressToUnit256Ptr("balances");
    }

    constructor(address _owner) {
        Storage.Address storage owner = Storage.addressPtr("owner");
        owner.set(_owner);
    }

    function transfer(address to, uint256 amount) external {
        mapping(address => uint256) storage balances = getBalancesMapping();

        balances[msg.sender] -= amount;
        balances[to] += amount;
    }

    function balanceOf(address who) external view returns(uint256) {
        mapping(address => uint256) storage balances = getBalancesMapping();
        return(balances[who]);
    }

    function totalSupply() external view returns(uint256) {
        Storage.Uint256 storage totalSupply = getTotalSupply();
        return(totalSupply.load());
    }
    
    modifier onlyOwner {
        Storage.Address storage owner = getOwner();
        require(msg.sender == owner.load(), "unauthorized");
        _;
    }

    function mint(address to, uint256 amount) external onlyOwner() {
        Storage.Uint256 storage totalSupply = getTotalSupply();
        mapping(address => uint256) storage balances = getBalancesMapping();

        balances[to] += amount;
        uint256 localTotalSupply = totalSupply.load();
        totalSupply.set(localTotalSupply + amount);
    }
}