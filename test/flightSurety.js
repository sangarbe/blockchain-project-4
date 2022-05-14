const {expectRevert} = require('@openzeppelin/test-helpers');
const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");

contract('Flight Surety Tests', async (accounts) => {

  let flightSuretyData;
  let flightSuretyApp;

  const STATUS_CODE_LATE_AIRLINE = 20;

  before('setup contract', async () => {
    flightSuretyData = await FlightSuretyData.new();
    flightSuretyApp = await FlightSuretyApp.new(flightSuretyData.address);

    await flightSuretyData.authorizeCaller(flightSuretyApp.address);
  });

  it(`(operational) has correct initial value`, async () => {
    let status = await flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(operational) cannot change status if not the owner`, async () => {
    await expectRevert.unspecified(flightSuretyData.setOperatingStatus(false, {from: accounts[2]}));
    assert.equal(await flightSuretyData.isOperational.call(), true, "Operational status has unexpectedly changed");
  });

  it(`(operational) can change status if not the owner`, async () => {
    await flightSuretyData.setOperatingStatus(false);
    assert.equal(await flightSuretyData.isOperational.call(), false, "Owner did not change operational status");
  });

  it(`(operational) functions access is blocked when not operational`, async () => {
    await expectRevert(flightSuretyData.authorizeCaller(accounts[2], {from: accounts[9]}), "Contract is currently not operational");
    await expectRevert(flightSuretyData.registerAirline(accounts[2], {from: accounts[9]}), "Contract is currently not operational");
    await expectRevert(flightSuretyData.fund({from: accounts[9]}), "Contract is currently not operational");
    await expectRevert(flightSuretyData.registerFlight("flight x", Math.round(Date.now() / 1000), {from: accounts[9]}), "Contract is currently not operational");
    await expectRevert(flightSuretyData.buy("flight x", {from: accounts[9]}), "Contract is currently not operational");
    await flightSuretyData.setOperatingStatus(true);
  });

  it(`(separation of concerns) functions access is blocked if not from authenticated caller`, async () => {
    await expectRevert(flightSuretyData.registerAirline(accounts[2], {from: accounts[9]}), "Caller is not authorized");
    await expectRevert(flightSuretyData.registerFlight("flight x", Math.round(Date.now() / 1000), {from: accounts[9]}), "Caller is not authorized");
    await expectRevert(flightSuretyData.updateFlightStatus("flight x", 10, {from: accounts[9]}), "Caller is not authorized");
    await expectRevert(flightSuretyData.creditInsurees("flight x", {from: accounts[9]}), "Caller is not authorized");
  });

  it('(airlines) an airline cannot register if it is not funded', async () => {
    await expectRevert(flightSuretyApp.registerAirline(accounts[2]), "Not funded airline can't participate");
    assert.equal(await flightSuretyData.isAirline.call(accounts[2]), false, "Airline without funding managed to register another");
  });

  it('(airlines) not registered airlines cannot be funded', async () => {
    await expectRevert(flightSuretyData.fund({from: accounts[2]}), "Airline is not registered");
    assert.equal(await flightSuretyData.isAirline.call(accounts[2]), false, "Airline funded before registering");
  });

  it('(airlines) can not be funded without enough value', async () => {
    await expectRevert(flightSuretyData.fund({value: web3.utils.toWei("5", "ether")}), "Minimum funds are 10 ether");
    assert.equal(await flightSuretyData.isAirline.call(accounts[0]), false, "Airline funded with not enough value");
  });

  it('(airlines) can be funded', async () => {
    const tx = await flightSuretyData.fund({value: web3.utils.toWei("10", "ether")});
    assert.equal(await flightSuretyData.isAirline.call(accounts[0]), true, "Airline not funded");
  });

  it('(airlines) an airline can register up to 4 airlines without consensus', async () => {
    for (let i = 1; i < 4; i++) {
      await flightSuretyApp.registerAirline(accounts[i]);
      assert.equal(await flightSuretyData.isAirline.call(accounts[i]), false, `Airline ${i} added without funding`);
      await flightSuretyData.fund({value: web3.utils.toWei("10", "ether"), from: accounts[i]});
      assert.equal(await flightSuretyData.isAirline.call(accounts[i]), true, `Airline ${i} not registered`);
      assert.equal(await flightSuretyData.participants.call(), i + 1, `Airline ${i} not accounted`);
    }
  });

  it('(airlines) an airline can not register a fifth airline without consensus', async () => {
    await flightSuretyApp.registerAirline(accounts[4]);
    assert.equal(await flightSuretyData.isAirline.call(accounts[4]), false, `Airline added without funding`);
    await expectRevert(flightSuretyData.fund({
      value: web3.utils.toWei("10", "ether"),
      from: accounts[4]
    }), "Airline is not registered");
    assert.equal(await flightSuretyData.participants.call(), 4, `Airline accounted`);
  });

  it('(airlines) fifth airline gets registered when consensus reached', async () => {
    await flightSuretyApp.registerAirline(accounts[4], {from: accounts[1]});
    assert.equal(await flightSuretyData.isAirline.call(accounts[4]), false, `Airline added without funding`);
    await flightSuretyData.fund({value: web3.utils.toWei("10", "ether"), from: accounts[4]});
    assert.equal(await flightSuretyData.participants.call(), 5, `Airline not accounted`);
  });

  it('(flights) participant airlines can register flights', async () => {
    const flight = "flight 1";
    await flightSuretyApp.registerFlight(flight, Math.ceil(Date.now() / 1000), {from: accounts[1]});
    assert.equal(await flightSuretyData.isFlight.call(flight), true, `Flight not registered`);
  });

  it('(flights) registration fails if done twice', async () => {
    const flight = "flight 1";
    await expectRevert(flightSuretyApp.registerFlight(flight, Math.ceil(Date.now() / 1000), {from: accounts[1]}), "Flight already registered");
  });

  it('(flights) registration fails if flight already took off', async () => {
    const flight = "flight 2";
    await expectRevert(flightSuretyApp.registerFlight(flight, Math.floor(Date.now() / 1000) - 60, {from: accounts[1]}), "Flight already took off");
  });

  it('(passengers) registration fails if flight not registered', async () => {
    const flight = "flight 2";
    await expectRevert(flightSuretyData.buy(flight, {from: accounts[1]}), "Flight is not registered");
  });

  it('(passengers) can not buy a flight if paid 0', async () => {
    const flight = "flight 1";
    await expectRevert(flightSuretyData.buy(flight, {from: accounts[8]}), "Should pay something");
    assert.equal(await flightSuretyData.isInsuree.call(flight, accounts[8]), false, `Insured with no payment`);
  });

  it('(passengers) can not buy a flight paid more than 1 ether', async () => {
    const flight = "flight 1";
    await expectRevert(flightSuretyData.buy(flight, {
      from: accounts[8],
      value: web3.utils.toWei("2", "ether")
    }), "Can not pay more than 1 ether");
    assert.equal(await flightSuretyData.isInsuree.call(flight, accounts[8]), false, `Passenger paid above limit`);
  });

  it('(passengers) can buy a flight paying up to 1 ether', async () => {
    const flight = "flight 1";
    await flightSuretyData.buy(flight, {from: accounts[8], value: web3.utils.toWei("1", "ether")});
    assert.equal(await flightSuretyData.isInsuree.call(flight, accounts[8]), true, `Passenger not an insuree`);
    assert.equal(await flightSuretyData.credits.call(accounts[8]), 0, `Insuree credited before flight issue`);
  });

  it('(passengers) are not credited if issue is not due to the airline', async () => {
    const now = Math.ceil(Date.now() / 1000) + 1;
    const oracle = accounts[7];
    const flight = "flight 1";
    const fee = await flightSuretyApp.REGISTRATION_FEE.call();
    const tx = await flightSuretyApp.fetchFlightStatus(accounts[1], flight, now);
    let index = tx.logs[0].args[0].toString();

    console.log("index: ", index);
    do {
      await flightSuretyApp.registerOracle({from: oracle, value: fee});
      const indexes = await flightSuretyApp.getMyIndexes.call({from: oracle});
      console.log("oindexes: ", indexes.map((i) => i.toString()));
      if (indexes.find((i) => i.toString() === index)) break;
    } while (true)

    index = Number(index);
    await flightSuretyApp.submitOracleResponse(index, accounts[1], flight, now, 0, {from: oracle});
    await flightSuretyApp.submitOracleResponse(index, accounts[1], flight, now, 0, {from: oracle});
    await flightSuretyApp.submitOracleResponse(index, accounts[1], flight, now, 0, {from: oracle});

    assert.equal(await flightSuretyData.credits.call(accounts[8]), 0, `Insuree wrongly credited`);
  });

  it('(passengers) are credited with 1.5 times what they paid', async () => {
    const now = Math.ceil(Date.now() / 1000) + 1;
    const oracle = accounts[7];
    const flight = "flight 1";
    const fee = await flightSuretyApp.REGISTRATION_FEE.call();
    const tx = await flightSuretyApp.fetchFlightStatus(accounts[1], flight, now);
    let index = tx.logs[0].args[0].toString();

    do {
      await flightSuretyApp.registerOracle({from: oracle, value: fee});
      const indexes = await flightSuretyApp.getMyIndexes.call({from: oracle});
      if (indexes.find((i) => i.toString() === index)) break;
    } while (true)

    index = Number(index);
    await flightSuretyApp.submitOracleResponse(index, accounts[1], flight, now, STATUS_CODE_LATE_AIRLINE, {from: oracle});
    await flightSuretyApp.submitOracleResponse(index, accounts[1], flight, now, STATUS_CODE_LATE_AIRLINE, {from: oracle});
    await flightSuretyApp.submitOracleResponse(index, accounts[1], flight, now, STATUS_CODE_LATE_AIRLINE, {from: oracle});

    assert.equal(await flightSuretyData.credits.call(accounts[8]), web3.utils.toWei("1.5", "ether"), `Insuree not credited enough`);
  });

  it('(passengers) can withdraw credits', async () => {
    const passenger = accounts[8];
    const balance = Number(await web3.eth.getBalance(passenger));
    const credit = Number(await flightSuretyData.credits.call(passenger));

    const tx = await flightSuretyData.pay({from: passenger});
    const gasUsed = Number(tx.receipt.gasUsed);
    const gasPrice = Number(tx.receipt.effectiveGasPrice);
    const newBalance = Number(await web3.eth.getBalance(passenger));

    assert.equal(await flightSuretyData.credits.call(passenger), 0, `Credits not initialized`);
    assert.equal(newBalance, credit + balance - (gasPrice * gasUsed), `Credits not transferred`);
  });

});
