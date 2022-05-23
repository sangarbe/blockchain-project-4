import axios from 'axios';
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';

function display(title, description, results) {
  console.log(results);
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  results.map((result) => {
    let row = section.appendChild(DOM.div({className: 'row'}));
    row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
    row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result?.error ? String(result.error) : String(result.value)));
    section.appendChild(row);
  })
  displayDiv.append(section);
}

async function checkOperational(contract) {
  let value, error;
  try {
    value = await contract.isOperational();
  } catch (e) {
    error = e
  }

  display('Operational Status', 'Check if contract is operational', [{label: 'Operational Status', error, value}]);
}

async function triggerOracles(contract, flight) {
  let result, error;
  try {
    result = await contract.fetchFlightStatus(flight);
  } catch (e) {
    error = e
  }

  display('Oracles', 'Trigger oracles', [{
    label: 'Fetch Flight Status',
    error,
    value: result.flight + ' ' + result.timestamp
  }]);
}

async function fetchFlights() {
  try {
    const result = await axios.get('http://localhost:3000/api/flights')
    const select = DOM.elid("flight-number");
    result.data.flights.forEach((flight) => {
      const option = DOM.option({id: flight[0]}, `${flight[0]} - ${new Date(flight[1] * 1000).toISOString()}`);
      select.appendChild(option);
    });
  } catch (error) {
    display('Flights', 'Fetch available flights', [{label: 'Available Flights', error}]);
  }
}

async function main() {
  await fetchFlights();

  const contract = new Contract('localhost');
  await contract.initialize();

  await checkOperational(contract);

  DOM.elid('submit-oracle').addEventListener('click', async () => {
    const flightSelect = DOM.elid('flight-number');
    const flight = flightSelect.options[flightSelect.selectedIndex].id;
    await triggerOracles(contract, flight);
  });
}

main();





