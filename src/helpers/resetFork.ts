import hre from "hardhat";

const { ALCHEMY_MAINNET_API_KEY } = process.env;

export async function resetFork() {
  console.log("resetting fork");
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_MAINNET_API_KEY}`,
          blockNumber: 15825655,
        },
      },
    ],
  });
}
