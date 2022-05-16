import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

const config = Config['localhost'];
const web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
const flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
const {REGISTRATION_FEE, registerOracle, getMyIndexes, submitOracleResponse} = flightSuretyApp.methods;
const statusCodes = [0, 10, 10, 20, 20, 20, 20, 30, 40, 50]; // 40% probability of airline fault

async function registerOracles() {
  const accounts = await web3.eth.getAccounts();
  const defaultAccount = accounts[0];
  const gasLimit = 100000;

  const fee = await REGISTRATION_FEE().call({from: defaultAccount});

  const oracles = [];
  for (let i = 5; i < accounts[i]; i++) {
    try {
      await registerOracle().send({from: accounts[i], value: fee, gas: gasLimit});
      const result = await getMyIndexes().call({from: accounts[i]});

      oracles.push({
        oracle: accounts[i],
        indexes: result.map((i) => i.toString()),
        code: statusCodes[i % statusCodes.length]
      })
    } catch (err) {
      console.log(`Error registering oracle ${accounts[i]}: ${err.reason || "reverted by EVM without reason"}`);
    }
  }

  console.log(oracles);
  return oracles;
}

async function main() {
  const oracles = await registerOracles();

  flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, function (error, event) {
    if (error) console.log(error);
    console.log(event);

    const {index, airline, flight, timestamp} = event.returnValues;

    oracles.filter((item) =>
      !!item.indexes.find((item) => item === index.toString())
    ).forEach((item) =>
      submitOracleResponse(index, airline, flight, timestamp, item.code).send({from: item.oracle})
    )
  });
}

main();

const app = express();
app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

export default app;


