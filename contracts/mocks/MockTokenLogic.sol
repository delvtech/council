pragma solidity ^0.8.0;

import "../libraries/Storage.sol";

contract MockTokenLogic {
    // This contract is an implementation target for the proxy so uses the
    // proxy storage lib for safe portable slotting cross upgrades.
    using Storage for *;

    // We don't declare them but the following are our state variables
    // address owner
    // uint256 totalSupply
    // mapping(address => balance) balances

    constructor(address _owner) {
        Storage.Address storage owner = Storage.addressPtr("owner");
        owner.set(_owner);
    }

    function transfer(address to, uint256 amount) external {
        mapping(address => uint256) storage balances = Storage.mappingAddressToUnit256Ptr("balances");

        balances[msg.sender] -= amount;
        balances[to] += amount;
    }

    function balanceOf(address who) external view returns(uint256) {
        mapping(address => uint256) storage balances = Storage.mappingAddressToUnit256Ptr("balances");
        return(balances[who]);
    }

    function totalSupply() external view returns(uint256) {
        Storage.Uint256 storage totalSupply = Storage.uint256Ptr("totalSupply");
        return(totalSupply.load());
    }
    
    modifier onlyOwner {
        Storage.Address storage owner = Storage.addressPtr("owner");
        require(msg.sender == owner.load(), "unauthorized");
        _;
    }

    function mint(address to, uint256 amount) external onlyOwner() {
        Storage.Uint256 storage totalSupply = Storage.uint256Ptr("totalSupply");
        mapping(address => uint256) storage balances = Storage.mappingAddressToUnit256Ptr("balances");

        balances[to] += amount;
        uint256 localTotalSupply = totalSupply.load();
        totalSupply.set(localTotalSupply + amount);
    }
}