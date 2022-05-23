import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
  constructor(network) {
    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
    this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
    this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
    this.gasLimit = 9000000;
  }

  async initialize() {
    const accounts = await this.web3.eth.getAccounts()

    this.owner = accounts[0];

    let counter = 1;
    while (this.airlines.length < 5) {
      this.airlines.push(accounts[counter++]);
    }

    while (this.passengers.length < 5) {
      this.passengers.push(accounts[counter++]);
    }
  }

  async isOperational() {
    return await this.flightSuretyApp.methods
      .isOperational()
      .call({from: this.owner});
  }

  async fetchFlightStatus(flight) {
    const payload = {
      airline: this.airlines[0],
      flight: flight,
      timestamp: Math.floor(Date.now() / 1000)
    }

    await this.flightSuretyApp.methods
      .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
      .send({from: this.owner, gas: this.gasLimit});

    return payload;
  }

  async buyFlight(flight, amount) {
    const payload = {
      flight: flight,
      amount: this.web3.utils.toWei(amount, "ether")
    }

    await this.flightSuretyData.methods
      .buy(payload.flight)
      .send({from: this.passengers[0], value: payload.amount, gas: this.gasLimit});

    return payload;
  }
}