const {expectRevert} = require('@openzeppelin/test-helpers');
const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");

contract('Flight Surety Tests', async (accounts) => {

  let flightSuretyData;
  let flightSuretyApp;

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
    await expectRevert(flightSuretyData.authorizeCaller(accounts[2]), "Contract is currently not operational");
    await expectRevert(flightSuretyData.registerAirline(accounts[2]), "Contract is currently not operational");
    await expectRevert(flightSuretyData.fund(), "Contract is currently not operational");
    await flightSuretyData.setOperatingStatus(true);
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
    await flightSuretyData.fund({value: web3.utils.toWei("10", "ether")});
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
    await expectRevert(flightSuretyData.fund({value: web3.utils.toWei("10", "ether"), from: accounts[4]}), "Airline is not registered");
    assert.equal(await flightSuretyData.participants.call(), 4, `Airline accounted`);
  });

  it('(airlines) fifth airline gets registered when consensus reached', async () => {
    await flightSuretyApp.registerAirline(accounts[4], {from: accounts[1]});
    assert.equal(await flightSuretyData.isAirline.call(accounts[4]), false, `Airline added without funding`);
    await flightSuretyData.fund({value: web3.utils.toWei("10", "ether"), from: accounts[4]});
    assert.equal(await flightSuretyData.participants.call(), 5, `Airline not accounted`);
  });

});
