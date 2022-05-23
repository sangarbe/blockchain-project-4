import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
  constructor(network) {
    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
    this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
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
    let payload = {
      airline: this.airlines[0],
      flight: flight,
      timestamp: Math.floor(Date.now() / 1000)
    }

    await this.flightSuretyApp.methods
      .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
      .send({from: this.owner});

    return payload;
  }
}