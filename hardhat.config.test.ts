import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import "solidity-coverage";

import { HardhatUserConfig } from "hardhat/config";

import config from "./hardhat.config";

const testConfig: HardhatUserConfig = {
  ...config,
  networks: {
    ...config.networks,
    hardhat: {
      ...config?.networks?.hardhat,
      allowUnlimitedContractSize: true,
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET_API_KEY}`,
    },
  },
};

export default testConfig;
