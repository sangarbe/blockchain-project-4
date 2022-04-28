pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Operational.sol";

contract FlightSuretyData is Operational {
    using SafeMath for uint256;

    mapping(address => bool) private _callers;

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor() public
    {
    }

    /**
    * @dev Modifier that requires the caller to be previously authorized. For app proxy contracts.
    */
    modifier requireAuthorizedCaller()
    {
        require(_callers[msg.sender], "Caller is not authorized");
        _;
    }


    /**
    * @dev Adds an address to be authorized as caller. Only authorized callers will be able to manage parts of the data.
    */
    function authorizeCaller(address callerAddress) external requireIsOperational onlyOwner
    {
        _callers[callerAddress] = true;
    }


    /**
     * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline
    (
    )
    external
    pure
    {
    }


    /**
     * @dev Buy insurance for a flight
    *
    */
    function buy
    (
    )
    external
    payable
    {

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
    (
    )
    external
    pure
    {
    }


    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
    (
    )
    external
    pure
    {
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund
    (
    )
    public
    payable
    {
    }

    function getFlightKey
    (
        address airline,
        string memory flight,
        uint256 timestamp
    )
    pure
    internal
    returns (bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function()
    external
    payable
    {
        fund();
    }
}

