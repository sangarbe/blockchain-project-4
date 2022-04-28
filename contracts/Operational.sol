pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Operational is Ownable {

    bool private _operational = true;

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        require(isOperational(), "Contract is currently not operational");
        _;
    }


    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns (bool)
    {
        return _operational;
    }

    /**
    * @dev Sets contract operations on/off
    */
    function setOperatingStatus(bool operational) external onlyOwner
    {
        _operational = operational;
    }
}

