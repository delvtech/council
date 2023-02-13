import { JsonRpcProvider } from "@ethersproject/providers";
import { expect } from "chai";
import { CoreVoting__factory } from "typechain";

import proposalArgs from "../proposalArgs.json";
import addressesJson from "../src/addresses";
import grants from "../src/grants";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import csvtojson from "csvtojson";
import { formatEther } from "ethers/lib/utils";

// const { provider } = ethers;
const { unfrozenVestingVaultAddress } = addressesJson.addresses;

const LOCAL_RPC_HOST = "http://127.0.0.1:8545";
const provider = new JsonRpcProvider(LOCAL_RPC_HOST);

describe("Update Grants", function () {
  describe("deployVaultUpgrade", async () => {
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    it("should deploy", async () => {
      expect(unfrozenVestingVaultAddress).to.be.eq(
        "0x01cf58e264d7578D4C67022c58A24CbC4C4a304E"
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
      expect(proposalArgs.targetsTimeLock).to.be.deep.eq([
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
        "0x6De73946eab234F1EE61256F10067D713aF0e37A",
      ]);

      expect(proposalArgs.calldatasTimeLock).to.be.deep.eq([
        "0x74474d2800000000000000000000000001cf58e264d7578d4c67022c58a24cbc4c4a304e", // upgrade to unfrozen vault
        // a bunch of reduceGrant calls
        "0xf9c251a7000000000000000000000000561c1693fd7c874763f99d0f456c0d2353c85e26000000000000000000000000000000000000000000002e69aae2e8c354700000",
        "0xf9c251a70000000000000000000000007c9c99a9c0bb31c054de1bd9af546db10e35785b000000000000000000000000000000000000000000000f50f3528cc0b22d0000",
        "0xf9c251a70000000000000000000000003a543655e484d9ad9ada138170254f5880b695ce0000000000000000000000000000000000000000000000000000000000000000",
        "0xf9c251a70000000000000000000000009814ca52e5235e9ea7709475893645bed9a9cf430000000000000000000000000000000000000000000000000000000000000000",
        "0xf9c251a7000000000000000000000000b603613b9e3f76ab26ce2a259f1db8ea5e9dc5950000000000000000000000000000000000000000000000000000000000000000",
        "0xf9c251a700000000000000000000000046aa35190959c7a639ada37a99068b6740a0a5ed0000000000000000000000000000000000000000000000000000000000000000",
        "0xf9c251a700000000000000000000000008627fcb1edd7006b9f71fbd5b0ec91b4d8dd50a0000000000000000000000000000000000000000000000000000000000000000",
        "0xf9c251a70000000000000000000000002592998309c9a89d9eaaf7cf7cfa94db8ba877030000000000000000000000000000000000000000000000000000000000000000",
        "0xf9c251a7000000000000000000000000b0ad0eea2061d1b699e6c0d353fdee59f40262bb000000000000000000000000000000000000000000006517c1dfd2e9bfce0000",
        "0xf9c251a7000000000000000000000000cf0fb739fb119b4e41e872a2a1223832900f036100000000000000000000000000000000000000000000137e4cd7a1d1cd270000",
        "0x74474d28000000000000000000000000716d4e863536ac862ad34bc4ecacba07d8831bea", // downgrad to frozen vault
      ]);
    });

    describe("createUpgradeProposal", async () => {
      beforeEach(async () => {
        await createSnapshot(provider);
      });
      afterEach(async () => {
        await restoreSnapshot(provider);
      });

      it("should create the proposal", async () => {
        const { coreVoting } = addressesJson.addresses;

        const coreVotingContract = CoreVoting__factory.connect(
          coreVoting,
          provider
        );

        const numProposalsAfter = await coreVotingContract.proposalCount();
        expect(numProposalsAfter.toNumber()).to.be.eq(5);
      });
    });

    describe("executeProposal", async () => {
      beforeEach(async () => {
        await createSnapshot(provider);
      });
      afterEach(async () => {
        await restoreSnapshot(provider);
      });

      it("update grants appropriately", async () => {
        const grantsAfter: GrantOutput[] = await csvtojson().fromFile(
          "grantsAfterAddRemove.csv"
        );

        // make sure all grants update like we want
        grants.forEach((grant) => {
          const grantAfter = grantsAfter.find((g) => g.address === grant.who);
          expect(formatEther(grant.amount).toString()).to.be.eq(
            grantAfter?.allocation
          );
        });
      });

      it("should downgrade proxy implemenation", async () => {
        expect(true).to.equal(false);
      });

      it("should have all excess tokens in unassigned", async () => {
        expect(true).to.equal(false);
      });
    });
  });
});

interface GrantOutput {
  address: string;
  allocation: string;
  withdrawn: string;
  created: string;
  expiration: string;
  cliff: string;
  latestVotingPower: string;
  delegatee: string;
  rangeStart: string;
  rangeEnd: string;
}
