pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Operational.sol";

contract FlightSuretyData is Operational {
    using SafeMath for uint256;

    uint8 private constant STATUS_CODE_ON_TIME      = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint256 private constant MIN_FUNDS              = 10 ether;

    enum AirlineStatus{EXCLUDED, QUEUED, REGISTERED, FUNDED}

    struct Airline {
        AirlineStatus status;
        address[] voters;
    }

    struct Flight {
        bool isRegistered;
        bool credited;
        uint8 statusCode;
        uint256 departureTimestamp;
        address airline;
    }

    mapping(string => Flight) private                      _flights;
    mapping(address => uint256) private                    _credits;
    mapping(string => mapping(address => uint256)) private _insurees;
    mapping(string => address[]) private                   _insureesList;

    address private                     _caller;
    mapping(address => Airline) private _airlines;
    uint private                        _participants = 0;

    /**
    * @dev Modifier that requires the caller to be previously authorized. For app proxy contracts.
    */
    modifier requireAuthorizedCaller()
    {
        require(_caller == msg.sender, "Caller is not authorized");
        _;
    }

    /**
    * @dev Modifier that requires the EOA to be a funded airline.
    */
    modifier requireFundedAirline()
    {
        require(isAirline(tx.origin), "Not funded airline can't participate");
        _;
    }

    /**
    * @dev Modifier that requires the caller to be a registered airline.
    */
    modifier requireRegisteredAirline()
    {
        require(_airlines[msg.sender].status == AirlineStatus.REGISTERED, "Airline is not registered");
        _;
    }

    /**
    * @dev Modifier that requires the caller to send enough funds of 10 ether.
    */
    modifier requireEnoughFunds()
    {
        require(msg.value >= MIN_FUNDS, "Minimum funds are 10 ether");
        _;
    }

    constructor() public
    {
        _airlines[msg.sender].status = AirlineStatus.REGISTERED;
    }

    /**
    * @dev Adds an address to be authorized as caller. Only authorized callers will be able to manage parts of the data.
    */
    function authorizeCaller(address callerAddress) external
    requireIsOperational
    onlyOwner
    {
        _caller = callerAddress;
    }

    /**
    * @dev Add an airline to the registration queue. Can only be called from FlightSuretyApp contract
    */
    function registerAirline(address airline) external
    requireIsOperational
    requireAuthorizedCaller
    requireFundedAirline
    returns (bool success, uint256 votes)
    {
        require(_airlines[airline].status < AirlineStatus.REGISTERED, "Airline already registered");

        if (_participants < 4) {
            _airlines[airline].status = AirlineStatus.REGISTERED;
            return (true, 1);
        }

        bool alreadyVoted = false;
        for (uint i = 0; i < _airlines[airline].voters.length; i++) {
            if (_airlines[airline].voters[i] == tx.origin) {
                alreadyVoted = true;
                break;
            }
        }

        if (!alreadyVoted) {
            _airlines[airline].voters.push(tx.origin);
        }

        if (_airlines[airline].voters.length >= _consensus()) {
            _airlines[airline].status = AirlineStatus.REGISTERED;
            return (true, _airlines[airline].voters.length);
        }

        _airlines[airline].status = AirlineStatus.QUEUED;
        return (false, _airlines[airline].voters.length);
    }

    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    */
    function fund() public payable
    requireIsOperational
    requireRegisteredAirline
    requireEnoughFunds
    {
        _airlines[msg.sender].status = AirlineStatus.FUNDED;
        _participants = _participants.add(1);
    }

    function isAirline(address airline) public view returns (bool)
    {
        return _airlines[airline].status == AirlineStatus.FUNDED;
    }

    function participants() public view returns (uint256)
    {
        return _participants;
    }

    /**
    * @dev Add a flight for an airline. Can only be called from FlightSuretyApp contract
    */
    function registerFlight(string flight, uint256 departureTimestamp) external
    requireIsOperational
    requireAuthorizedCaller
    requireFundedAirline
    {
        require(!_flights[flight].isRegistered, "Flight already registered");
        require(departureTimestamp > now, "Flight already took off");

        _flights[flight] = Flight(true, false, STATUS_CODE_ON_TIME, departureTimestamp, tx.origin);
    }

    /**
    * @dev Updates flight's status.
    */
    function updateFlightStatus(string flight, uint8 status) external
    requireIsOperational
    requireAuthorizedCaller
    {
        require(_flights[flight].isRegistered, "Flight is not registered");
        require(_flights[flight].statusCode <= STATUS_CODE_ON_TIME, "Flight is already late");

        _flights[flight].statusCode = status;
    }

    function isFlightRegistered(string flight) public view returns (bool)
    {
        return _flights[flight].isRegistered;
    }

    /**
    * @dev Buy insurance for a flight
    */
    function buy(string flight) external payable
    requireIsOperational
    {
        require(msg.value > 0, "Should pay something");
        require(_flights[flight].isRegistered, "Flight is not registered");
        require(_flights[flight].statusCode <= STATUS_CODE_ON_TIME, "Flight is already late");

        uint256 amount = _insurees[flight][msg.sender].add(msg.value);
        require(amount <= 1 ether, "Can not pay more than 1 ether");

        if (_insurees[flight][msg.sender] == 0) {
            _insureesList[flight].push(msg.sender);
        }

        _insurees[flight][msg.sender] = amount;
    }

    /**
    * @dev Credits payouts to insurees
    */
    function creditInsurees(string flight) external
    requireIsOperational
    requireAuthorizedCaller
    {
        require(!_flights[flight].credited, "Insurees already credited");
        require(_flights[flight].statusCode == STATUS_CODE_LATE_AIRLINE, "Flight is not late because of airline");

        _flights[flight].credited = true;

        for (uint i = 0; i < _insureesList[flight].length; i++) {
            address passenger = _insureesList[flight][i];
            uint256 credit = _insurees[flight][passenger];
            credit = credit + credit.div(2);
            _credits[passenger] = _credits[passenger] + credit;
        }
    }


    /**
    * @dev Transfers eligible payout funds to insuree
    */
    function pay() external
    {
        uint256 credit = _credits[msg.sender];
        _credits[msg.sender] = 0;
        msg.sender.transfer(credit);
    }


    /**
    * @dev Calculates the amount of participants for consensus.
    */
    function _consensus() private returns (uint256)
    {
        uint256 half = _participants.div(2);
        if (_participants == half.mul(2)) {
            return half;
        }

        return half.add(1);
    }

    /**
    * @dev Fallback function for funding smart contract.
    */
    function()
    external
    payable
    {
        fund();
    }

}

