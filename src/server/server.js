import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

const config = Config['localhost'];
const web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
const flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
const flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
const {
  REGISTRATION_FEE,
  registerOracle,
  registerFlight,
  isAirline,
  getMyIndexes,
  submitOracleResponse
} = flightSuretyApp.methods;
const {fund, isFlight, authorizeCaller} = flightSuretyData.methods;
const statusCodes = [0, 10, 10, 20, 20, 20, 20, 30, 40, 50]; // 40% probability of airline fault
const gasLimit = 9000000;
const flights = [
  ["Flight 1", Math.ceil(Date.now() / 1000) + 1800],
  ["Flight 2", Math.ceil(Date.now() / 1000) + 3600],
  ["Flight 3", Math.ceil(Date.now() / 1000) + 7200]
]

// Prints error message from transaction
function logError(err, info) {
  console.log(`${info}: ${err.reason || "reverted by EVM without reason"}`);
  console.log(err)
}

// Prints info message
function logInfo(info) {
  console.log(info);
}

// Registers all the oracles
async function registerOracles(accounts) {
  const defaultAccount = accounts[0];
  const fee = await REGISTRATION_FEE().call({from: defaultAccount});

  const oracles = [];
  for (let i = 5; i < accounts.length; i++) {
    try {
      await registerOracle().send({from: accounts[i], value: fee, gas: gasLimit});
      const result = await getMyIndexes().call({from: accounts[i]});

      oracles.push({
        oracle: accounts[i],
        indexes: result.map((i) => i.toString()),
        code: statusCodes[i % statusCodes.length]
      })
    } catch (err) {
      logError(err, `Error registering oracle ${accounts[i]}`);
    }
  }

  return oracles;
}

// Submits the status code for a flight
async function submitResponse(event, oracle) {
  const {index, airline, flight, timestamp} = event.returnValues;

  if (!oracle.indexes.find((item) => item === index.toString())) return;

  try {
    logInfo(`oracle ${oracle.oracle} submitting code ${oracle.code} for flight ${flight}`)
    await submitOracleResponse(index, airline, flight, timestamp, oracle.code).send({
      from: oracle.oracle,
      gas: gasLimit
    })
  } catch (err) {
    logError(err, `oracle ${oracle.oracle} failed submiting response for flight ${flight}`);
  }
}

// Funds a registered airline
async function fundAirline(airline) {
  const ok = await isAirline(airline).call()
  if (ok) return;

  try {
    await fund().send({
      from: airline,
      value: web3.utils.toWei('10', 'ether'),
      gas: gasLimit
    })
  } catch (err) {
    logError(err, `Error funding airline ${airline}`);
  }
}

// Registers a bunch of flights
async function registerInitialFlights(airline) {

  try {
    await authorizeCaller(config.appAddress).send({from: airline});
  } catch (err) {
    logError(err, `Error authorizing caller`);
  }

  for (let i = 0; i < flights.length; i++) {
    const [flight, time] = flights[i];
    const ok = await isFlight(flight).call({from: airline})
    if (ok) continue;

    try {
      await registerFlight(flight, time.toString()).send({from: airline, gas: gasLimit});
    } catch (err) {
      logError(err, `Error registering flight ${flight} ${time.toString()}`);
    }
  }
}

// Main oracles function
async function main() {
  const accounts = await web3.eth.getAccounts();
  const defaultAirline = accounts[0];

  await fundAirline(defaultAirline);
  await registerInitialFlights(defaultAirline);

  const oracles = await registerOracles(accounts);

  flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }).on('data', (event) => {
    console.log(event);
    oracles.forEach((oracle) => submitResponse(event, oracle));
  }).on('error', (err) => console.log);
}

main();

const app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

app.get('/api/flights', (req, res) => {
  res.send({ flights })
})

export default app;


