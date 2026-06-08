require("dotenv").config();
require("@nomiclabs/hardhat-ethers");

const { ALCHEMY_RPC_URL, ORCHESTRA_CHAIN_ID } = process.env;

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_RPC_URL || "",
      chainId: 11155111,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};
