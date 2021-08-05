import { MockProvider } from "ethereum-waffle";

export const advanceBlock = async (provider: MockProvider) => {
  await provider.send("evm_mine", []);
};
export const advanceBlocks = async (provider: MockProvider, num: number) => {
  for (let i = 0; i < num; i++) {
    await advanceBlock(provider);
  }
};
