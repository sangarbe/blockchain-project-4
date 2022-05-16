var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {
  networks: {
    develop: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:7545/", 0, 50);
      },
      port: 7545,
      network_id: '*',
      gas: 9999999,
      accounts: 30,
    }
  },
  compilers: {
    solc: {
      version: "pragma",
      parser: "solcjs"
    }
  }
};