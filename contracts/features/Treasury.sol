// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.3;

import "../libraries/Authorizable.sol";
import "../interfaces/IERC20.sol";

// This contract is designed to hold the erc20 and eth reserves of the dao
// and will likely control a large amount of funds. It is designed to be
// flexible, secure and simple
contract Treasury is Authorizable {
    // A constant which represents ether
    address internal constant _ETH_CONSTANT =
        address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    /// @notice constructor.
    /// @param __governance Governance contract address.
    constructor(address __governance) {
        setOwner(__governance);
    }

    ///@notice Sends funds from the treasury to an address.
    ///@param _token Either (1) An ERC20 token address
    /// or (2) the _ETH_CONSTANT to use transfer ETH.
    ///@param _amount The amount of ETH or ERC20 to send.
    ///@param _recipient The recipient of this value.
    function sendFunds(
        address _token,
        uint256 _amount,
        address _recipient
    ) external onlyOwner {
        if (_token == _ETH_CONSTANT) {
            payable(_recipient).transfer(_amount);
        } else {
            // onlyGovernance should protect from reentrancy
            IERC20(_token).transfer(_recipient, _amount);
        }
    }

    ///@notice Sets an ERC20 allowance from this contract to a _spender.
    ///@param _token The ERC20 token address.
    ///@param _spender The recipient of the allowance.
    ///@param _amount The amount of the allowance.
    function approve(
        address _token,
        address _spender,
        uint256 _amount
    ) external onlyOwner {
        IERC20(_token).approve(_spender, _amount);
    }

    ///@notice Performs a generic call from this contract.
    ///@param _target The target address where the call will be performed.
    ///@param _callData The execution calldata to pass.
    function genericCall(address _target, bytes calldata _callData)
        external
        onlyOwner
    {
        // We do a low level call and insist it succeeds
        (bool status, ) = _target.call(_callData);
        require(status, "Call failed");
    }

    // Receive is fine because we don't want to execute code
    receive() external payable {}
}
