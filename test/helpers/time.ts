import { MockProvider } from "ethereum-waffle";

export const advanceBlock = async (provider: MockProvider) => {
  await provider.send("evm_mine", []);
};
export const advanceBlocks = async (provider: MockProvider, num: number) => {
  for (let i = 0; i < num; i++) {
    await advanceBlock(provider);
  }
};
export const advanceTime = async (provider: MockProvider, time: number) => {
  await provider.send("evm_increaseTime", [time]);
  await provider.send("evm_mine", []);
};
