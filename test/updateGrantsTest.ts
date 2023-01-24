import { createUpdateTimeStampsProposal } from "src/createProposalUpdateTimestamps";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";

import { deployVaultUpgrade } from "src/deployVaultUpgrade";

import addressesJson from "../src/addresses";
import grants from "../src/grants";
import { UnfrozenVestingVault } from "../typechain/contracts/vaults/UnfrozenVestingVault";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { getUpdateGrantsProposalArgs } from "src/createProposalUpdateGrants";
import { createUpgradeGrantsProposal } from "../scripts/createUpgradeProposal";

const { provider } = ethers;

describe("Update Grants", function () {
  let signer: SignerWithAddress;
  let unfrozenVault: UnfrozenVestingVault;

  before(async function () {
    await createSnapshot(provider);
    [signer] = await ethers.getSigners();
    unfrozenVault = await deployVaultUpgrade(signer);
  });
  after(async () => {
    await restoreSnapshot(provider);
  });

  describe("deployVaultUpgrade", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it("should deploy", async () => {
      expect(unfrozenVault.address).to.be.eq(
        "0x1D13fF25b10C9a6741DFdce229073bed652197c7"
      );
    });
  });

  describe("getUpdateGrantsProposalArgs", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it("should get proposal args", async () => {
      const {
        timeLock,
        vestingVault,
        frozenVestingVaultAddress,
        unfrozenVestingVaultAddress,
      } = addressesJson.addresses;

      const proposalArgs = await getUpdateGrantsProposalArgs(
        provider,
        grants,
        unfrozenVestingVaultAddress,
        frozenVestingVaultAddress,
        vestingVault,
        timeLock
      );
      expect(proposalArgs).to.be.eq({
        targets: ["0x81758f3361A769016eae4844072FA6d7f828a651"],
        callDatas: [
          "0x88b49b8323a321f19d23a56e2a186b370738326477c0d9a5c6e7ecbdf1416455964e61b9",
        ],
        proposalHash:
          "0x80b54ecedfb8f4bddb77eda29bea0fe077ad1dfdd10be1e92f75f3e08b6a2869",
        targetsTimeLock: [
          "0x6De73946eab234F1EE61256F10067D713aF0e37A", // mainnet vesting vault proxy address
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
          "0x6De73946eab234F1EE61256F10067D713aF0e37A",
        ],
        calldatasTimeLock: [
          // upgrade implementation to 0x1D13fF25b10C9a6741DFdce229073bed652197c7
          "0x74474d280000000000000000000000001d13ff25b10c9a6741dfdce229073bed652197c7",
          // reduce grant                    address                                                                             amount
          "0xf9c251a7000000000000000000000000561c1693fd7c874763f99d0f456c0d2353c85e26000000000000000000000000000000000000000000002e69aae2e8c354700000",
          // reduce grant                    address                                                                             amount
          "0xf9c251a70000000000000000000000007c9c99a9c0bb31c054de1bd9af546db10e35785b000000000000000000000000000000000000000000000f50f3528cc0b22d0000",
          // reduce grant                    address                                                                             amount
          "0xf9c251a70000000000000000000000003a543655e484d9ad9ada138170254f5880b695ce0000000000000000000000000000000000000000000000000000000000000000",
          // reduce grant                    address                                                                             amount
          "0xf9c251a70000000000000000000000009814ca52e5235e9ea7709475893645bed9a9cf430000000000000000000000000000000000000000000000000000000000000000",
          // reduce grant                    address                                                                             amount
          "0xf9c251a7000000000000000000000000b603613b9e3f76ab26ce2a259f1db8ea5e9dc5950000000000000000000000000000000000000000000000000000000000000000",
          // reduce grant                    address                                                                             amount
          "0xf9c251a700000000000000000000000046aa35190959c7a639ada37a99068b6740a0a5ed0000000000000000000000000000000000000000000000000000000000000000",
          // reduce grant                    address                                                                             amount
          "0xf9c251a700000000000000000000000008627fcb1edd7006b9f71fbd5b0ec91b4d8dd50a0000000000000000000000000000000000000000000000000000000000000000",
          // reduce grant                    address                                                                             amount
          "0xf9c251a70000000000000000000000002592998309c9a89d9eaaf7cf7cfa94db8ba877030000000000000000000000000000000000000000000000000000000000000000",
          // reduce grant                    address                                                                             amount
          "0xf9c251a7000000000000000000000000b0ad0eea2061d1b699e6c0d353fdee59f40262bb000000000000000000000000000000000000000000006517c1dfd2e9bfce0000",
          // reduce grant                    address                                                                             amount
          "0xf9c251a7000000000000000000000000cf0fb739fb119b4e41e872a2a1223832900f036100000000000000000000000000000000000000000000137e4cd7a1d1cd270000",
          // reduce grant                    address                                                                             amount
          "0x74474d28000000000000000000000000716d4e863536ac862ad34bc4ecacba07d8831bea", // upgrade implementation (back to original)
        ],
        callHashTimelock:
          "0x23a321f19d23a56e2a186b370738326477c0d9a5c6e7ecbdf1416455964e61b9",
      });
    });
  });

  describe("createUpgradeProposal", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it.skip("should create the proposal", async () => {
      const {
        timeLock,
        vestingVault,
        frozenVestingVaultAddress,
        unfrozenVestingVaultAddress,
      } = addressesJson.addresses;

      await createUpgradeGrantsProposal();

      expect(unfrozenVault.address).to.be.eq(
        "0x1D13fF25b10C9a6741DFdce229073bed652197c7"
      );
    });
  });
});
