import { expect } from "chai";

import csvtojson from "csvtojson";

import chai from "chai";
import chaiAlmost from "chai-almost";

chai.use(chaiAlmost(1));

describe("Update Timestamps", function () {
  it("update grants appropriately", async () => {
    const grantsBefore: GrantOutput[] = await csvtojson().fromFile(
      "grants.csv"
    );

    const grantsAfter: GrantOutput[] = await csvtojson().fromFile(
      "grantsAfterUpdateTimeStamps.csv"
    );

    // make sure all grants update like we want
    grantsAfter.forEach((grant) => {
      // timestamps accurate to +/- 1 block
      expect(Number(grant.created)).to.almost.eq(16952557);
      expect(Number(grant.cliff)).to.almost.eq(16952557);
      expect(Number(grant.expiration)).to.almost.eq(22185233);
    });

    // all other keys should not be changed
    const unchangedValues: (keyof GrantOutput)[] = [
      "allocation",
      "withdrawn",
      // "created",
      // "cliff",
      // "expiration",
      "latestVotingPower",
      "delegatee",
      "rangeStart",
      "rangeEnd",
    ];

    grantsBefore.forEach((grantBefore, i) => {
      const grantAfter = grantsAfter[i];
      unchangedValues.forEach((value) => {
        expect(grantBefore[value]).to.equal(grantAfter[value]);
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
