import "module-alias/register";

import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumberish, BigNumber } from "ethers";
import { MockHistoryTracker } from "../typechain/MockHistoryTracker";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

const { provider } = waffle;

describe("Historical data tracker", function () {
  // We use the history tracker and signers in each test
  let historicalTracker: MockHistoryTracker;
  const [wallet] = provider.getWallets();
  let signers: SignerWithAddress[];

  before(async function () {
    // Create a before snapshot
    await createSnapshot(provider);
    signers = await ethers.getSigners();
    // deploy the contract
    const deployer = await ethers.getContractFactory(
      "MockHistoryTracker",
      signers[0]
    );
    historicalTracker = await deployer.deploy();
  });
  // After we reset our state in the fork
  after(async () => {
    await restoreSnapshot(provider);
  });

  describe("Pushes things into history", async () => {
    // We use these hooks to erase changes between tests
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    // Check that the trivial one unit push works
    it("Push once", async () => {
      // Push once
      await historicalTracker.push(254689);
      // Look at the array
      const data = await historicalTracker.peekArrayData(0, 1);
      // get current block number, note hardhat only mines when a tx happens
      // so this will be the right one
      const blocknumber = await network.provider.send("eth_blockNumber");
      // Load the stored lengths
      const lengths = await historicalTracker.loadBounds();
      // Check the stored data
      expect(data[0][0]).to.be.eq(blocknumber);
      expect(data[1][0]).to.be.eq(254689);
      expect(lengths[0]).to.be.eq(0);
      expect(lengths[1]).to.be.eq(1);
    });
    // Check that we can store 2^192 - 1
    it("Pushes max value successfully", async () => {
      const maxValue = BigNumber.from(1).shl(192).sub(1);
      await historicalTracker.push(maxValue);

      const data = await historicalTracker.peekArrayData(0, 10);
      const blocknumber = await network.provider.send("eth_blockNumber");
      const lengths = await historicalTracker.loadBounds();

      expect(data[0][0]).to.be.eq(blocknumber);
      expect(data[1][0]).to.be.eq(maxValue);
      expect(lengths[0]).to.be.eq(0);
      expect(lengths[1]).to.be.eq(1);
    });
    // Check that we can't store 2^192
    it("Reverts on pushes above max", async () => {
      const maxValue = BigNumber.from(1).shl(192);
      const tx = historicalTracker.push(maxValue);
      await expect(tx).to.be.revertedWith("OoB");
    });
    // We push 100 random pieces of data and check the implementation
    // has done it right
    it("Pushes 100 pieces of random data and retrieves it", async () => {
      const pushedData = [];
      const blockNumbers = [];
      let previousBlockhash = "0xf00dbabe";

      for (let i = 0; i < 100; i++) {
        // This gets us a non crypto random bn with no bits higher than 192
        const toBePushed = BigNumber.from(previousBlockhash).mask(192);
        // This tries to push
        const tx = await historicalTracker.push(toBePushed);
        const awaitTx = await tx.wait(1);
        // Gives me pseudo random data and will be different each run
        previousBlockhash = awaitTx.blockHash;
        const blocknumber = awaitTx.blockNumber;
        // Record what the real answers should be
        pushedData.push(toBePushed);
        blockNumbers.push(blocknumber);
      }

      const arrayState = await historicalTracker.peekArrayData(0, 100);

      // Check that we've got the right array
      for (let i = 0; i < 100; i++) {
        expect(arrayState[0][i]).to.be.deep.eq(blockNumbers[i]);
        expect(arrayState[1][i]).to.be.deep.eq(pushedData[i]);
      }

      const lengths = await historicalTracker.loadBounds();
      expect(lengths[0]).to.be.eq(0);
      expect(lengths[1]).to.be.eq(100);
    });
    // We check that if we push a bunch with the same block number only the
    // last one makes it into the state
    it("Compresses repeated indices", async () => {
      // Let's add some random data to the start
      const pushedData = [];
      const blockNumbers = [];
      let previousBlockhash = "0xf00dbabe";

      for (let i = 0; i < 5; i++) {
        // This gets us a non crypto random bn with no bits higher than 192
        const toBePushed = BigNumber.from(previousBlockhash).mask(192);
        // This tries to push
        const tx = await historicalTracker.push(toBePushed);
        const awaitTx = await tx.wait(1);
        // Gives me pseudo random data and will be different each run
        previousBlockhash = awaitTx.blockHash;
        const blocknumber = awaitTx.blockNumber;
        // Record what the real answers should be
        pushedData.push(toBePushed);
        blockNumbers.push(blocknumber);
      }

      // Call a method which pushes an arbitrary number of times in one block
      await historicalTracker.multiPush([1, 2, 3, 4, 5]);
      const arrayState = await historicalTracker.peekArrayData(0, 6);
      const blocknumber = await network.provider.send("eth_blockNumber");

      // Check that we've got the right array for random data
      for (let i = 0; i < 5; i++) {
        expect(arrayState[0][i]).to.be.deep.eq(blockNumbers[i]);
        expect(arrayState[1][i]).to.be.deep.eq(pushedData[i]);
      }
      // Check that the 6th is the correct value
      expect(arrayState[0][5]).to.be.deep.eq(blocknumber);
      expect(arrayState[1][5]).to.be.deep.eq(5);

      // Check the length is correct
      const lengths = await historicalTracker.loadBounds();
      expect(lengths[0]).to.be.eq(0);
      expect(lengths[1]).to.be.eq(6);
    });
    it("compresses multiple pushes in the same block on the first push", async () => {
      const awaitTx = await historicalTracker.multiPush([1, 2, 3, 4, 5]);
      const blocknumber = awaitTx.blockNumber;
      const arrayState = await historicalTracker.peekArrayData(0, 6);
      // Check that the 1th is the correct value
      expect(arrayState[0][0]).to.be.deep.eq(blocknumber);
      expect(arrayState[1][0]).to.be.deep.eq(5);
      // Check that no extra data exists
      expect(arrayState[0][1]).to.be.deep.eq(0);
      expect(arrayState[1][1]).to.be.deep.eq(0);
      // Check that the length is 1 and min index 0
      const lengths = await historicalTracker.loadBounds();
      expect(lengths[0]).to.be.eq(0);
      expect(lengths[1]).to.be.eq(1);
    });
  });

  describe("Finds exact match block numbers in an array", async () => {
    const pushedData: BigNumberish[] = [];
    const blockNumbers: BigNumberish[] = [];
    let previousBlockhash = "0xf00dbabe";

    before(async () => {
      // Snapshot before testing the search
      await createSnapshot(provider);
      // We add a bunch of random data
      for (let i = 0; i < 100; i++) {
        // This gets us a non crypto random bn with no bits higher than 192
        const toBePushed = BigNumber.from(previousBlockhash).mask(192);
        // This tries to push
        const tx = await historicalTracker.push(toBePushed);
        const awaitTx = await tx.wait(1);
        // Gives me pseudo random data and will be different each run
        previousBlockhash = awaitTx.blockHash;
        const blocknumber = awaitTx.blockNumber;
        // Record what the real answers should be
        pushedData.push(toBePushed);
        blockNumbers.push(blocknumber);
      }
    });
    // After we add the random data we
    after(async () => {
      await restoreSnapshot(provider);
    });

    // Try getting the two extremes
    it("Finds the first", async () => {
      const result = await historicalTracker.find(blockNumbers[0]);
      expect(result).to.be.eq(pushedData[0]);
    });
    it("Finds the last", async () => {
      const result = await historicalTracker.find(blockNumbers[99]);
      expect(result).to.be.eq(pushedData[99]);
    });

    // Try some random searches
    it("Correctly finds all 100 elements", async () => {
      for (let i = 0; i < 99; i++) {
        const result = await historicalTracker.find(blockNumbers[i]);
        expect(result).to.be.eq(pushedData[i]);
      }
    });
  });

  describe("Finds nearest lesser match block numbers in an array", async () => {
    const pushedData: BigNumberish[] = [];
    const blockNumbers: BigNumberish[] = [];
    let previousBlockhash = "0xf00dbabe";

    before(async () => {
      // Snapshot before testing the search
      await createSnapshot(provider);
      // We add a bunch of random data
      for (let i = 0; i < 100; i++) {
        // This gets us a non crypto random bn with no bits higher than 192
        const toBePushed = BigNumber.from(previousBlockhash).mask(192);
        // This tries to push
        const tx = await historicalTracker.push(toBePushed);
        const awaitTx = await tx.wait(1);
        // Gives me pseudo random data and will be different each run
        previousBlockhash = awaitTx.blockHash;
        const blocknumber = awaitTx.blockNumber;
        // Record what the real answers should be
        pushedData.push(toBePushed);
        blockNumbers.push(blocknumber);

        // We mine a random number of blocks in the loop
        const blocks = Math.round(Math.random() * 10) + 1;
        for (let j = 0; j < blocks; j++) {
          await provider.send("evm_mine", []);
        }
      }
    });
    // After we add the random data we
    after(async () => {
      await restoreSnapshot(provider);
    });

    // Try getting the two extremes
    it("Finds the first", async () => {
      const result = await historicalTracker.find(
        BigNumber.from(blockNumbers[0]).add(1)
      );
      expect(result).to.be.eq(pushedData[0]);
    });
    it("Finds the last", async () => {
      const result = await historicalTracker.find(100000000);
      expect(result).to.be.eq(pushedData[99]);
    });

    // Try some random searches
    it("Correctly finds the greatest lesser block for all 100", async () => {
      for (let i = 0; i < 100; i++) {
        const result = await historicalTracker.find(
          BigNumber.from(blockNumbers[i]).add(1)
        );
        expect(result).to.be.eq(pushedData[i]);
      }
    });
  });

  describe("Clears properly", async () => {
    const pushedData: BigNumberish[] = [];
    const blockNumbers: BigNumberish[] = [];
    let previousBlockhash = "0xf00dbabe";

    before(async () => {
      // Snapshot before testing the search
      await createSnapshot(provider);
      // We add a bunch of random data
      for (let i = 0; i < 100; i++) {
        // This gets us a non crypto random bn with no bits higher than 192
        const toBePushed = BigNumber.from(previousBlockhash).mask(192);
        // This tries to push
        const tx = await historicalTracker.push(toBePushed);
        const awaitTx = await tx.wait(1);
        // Gives me pseudo random data and will be different each run
        previousBlockhash = awaitTx.blockHash;
        const blocknumber = awaitTx.blockNumber;
        // Record what the real answers should be
        pushedData.push(toBePushed);
        blockNumbers.push(blocknumber);

        // We mine a random number of blocks in the loop
        const blocks = Math.round(Math.random() * 10) + 1;
        for (let j = 0; j < blocks; j++) {
          await provider.send("evm_mine", []);
        }
      }
    });
    // After we add the random data we
    after(async () => {
      await restoreSnapshot(provider);
    });

    // We reset after each clear
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    Array.from(Array(99).keys()).forEach((i) => {
      it(`clears safely ${i}th trial `, async () => {
        const staleBlock = BigNumber.from(blockNumbers[i]).add(1);
        historicalTracker.findAndClear(
          BigNumber.from(blockNumbers[i]).add(1),
          staleBlock
        );
        const data = await historicalTracker.peekArrayData(0, 100);

        // We check that
        let deleted = 0;
        for (let j = 0; j < data[0].length; j++) {
          // If we have deleted an element
          if (data[0][j].toNumber() == 0) {
            // then it should have been stale
            expect(BigNumber.from(blockNumbers[j]).lt(staleBlock)).to.be.eq(
              true
            );
            // and the element should be gone
            expect(data[1][j]).to.be.eq(0);
            deleted++;
          } else {
            // Otherwise we should not have removed data
            expect(data[1][j]).to.be.eq(pushedData[j]);
          }
        }

        const bounds = await historicalTracker.loadBounds();
        expect(bounds[1].toNumber()).to.be.eq(100);

        // Min index is the length minus deleted elements
        expect(deleted).to.be.eq(bounds[0].toNumber());

        // We expect that everything before min index is zero
        for (let j = 0; j < bounds[0].toNumber(); j++) {
          expect(data[1][j].toNumber()).to.be.eq(0);
        }
        // We expect that everything after min index is not zero
        for (let j = bounds[0].toNumber(); j < 100; j++) {
          expect(data[1][j]).to.be.eq(pushedData[j]);
        }
      });
    });
    it("Leaves one when asked to clear everything", async () => {
      const staleBlock = BigNumber.from(blockNumbers[99]).add(1);
      historicalTracker.findAndClear(
        BigNumber.from(blockNumbers[99]).add(1),
        staleBlock
      );
      const data = await historicalTracker.peekArrayData(0, 100);

      const bounds = await historicalTracker.loadBounds();
      expect(bounds[1].toNumber()).to.be.eq(100);
      expect(bounds[0].toNumber()).to.be.eq(99);

      expect(data[0][99]).to.be.eq(blockNumbers[99]);
      expect(data[1][99]).to.be.eq(pushedData[99]);

      for (let i = 0; i < 99; i++) {
        expect(data[0][i]).to.be.eq(0);
        expect(data[1][i]).to.be.eq(0);
      }
    });
  });
  describe("Searches with non zero min value", async () => {
    const pushedData: BigNumberish[] = [];
    const blockNumbers: BigNumberish[] = [];
    let previousBlockhash = "0xf00dbabe";

    before(async () => {
      // Snapshot before testing the search
      await createSnapshot(provider);
      // We add a bunch of random data
      for (let i = 0; i < 100; i++) {
        // This gets us a non crypto random bn with no bits higher than 192
        const toBePushed = BigNumber.from(previousBlockhash).mask(192);
        // This tries to push
        const tx = await historicalTracker.push(toBePushed);
        const awaitTx = await tx.wait(1);
        // Gives me pseudo random data and will be different each run
        previousBlockhash = awaitTx.blockHash;
        const blocknumber = awaitTx.blockNumber;
        // Record what the real answers should be
        pushedData.push(toBePushed);
        blockNumbers.push(blocknumber);

        // We mine a random number of blocks in the loop
        const blocks = Math.round(Math.random() * 10) + 1;
        for (let j = 0; j < blocks; j++) {
          await provider.send("evm_mine", []);
        }
      }
    });
    // After we add the random data we
    after(async () => {
      await restoreSnapshot(provider);
    });

    // We reset after each clear
    beforeEach(async () => {
      await createSnapshot(provider);
    });
    afterEach(async () => {
      await restoreSnapshot(provider);
    });

    Array.from(Array(99).keys()).forEach((i) => {
      it(`clear and search ${i}th random trial`, async () => {
        const randIndex = Math.round(Math.random() * 98 + 1);
        await historicalTracker.clear(randIndex);

        const randSearch = Math.round(
          Math.random() * (99 - randIndex) + randIndex
        );
        const result = await historicalTracker.find(
          BigNumber.from(blockNumbers[randSearch]).add(1)
        );
        expect(result).to.be.eq(pushedData[randSearch]);
      });
    });

    it("Can't search under the min", async () => {
      await historicalTracker.clear(50);
      const tx = historicalTracker.find(
        BigNumber.from(blockNumbers[49]).add(1)
      );
      await expect(tx).to.be.revertedWith("Search Failure");
    });
  });
  describe("It loads the top of the array properly", async () => {
    it("Pushes 100 elements and loads them correctly when they are the top", async () => {
      let previousBlockhash = "0xf00dbabe";

      for (let i = 0; i < 100; i++) {
        // This gets us a non crypto random bn with no bits higher than 192
        const toBePushed = BigNumber.from(previousBlockhash).mask(192);
        // This tries to push
        const tx = await historicalTracker.push(toBePushed);
        const awaitTx = await tx.wait(1);
        // Gives me pseudo random data and will be different each run
        previousBlockhash = awaitTx.blockHash;
        const blocknumber = awaitTx.blockNumber;

        // We mine a random number of blocks in the loop
        const blocks = Math.round(Math.random() * 10) + 1;
        for (let j = 0; j < blocks; j++) {
          await provider.send("evm_mine", []);
        }

        const top = await historicalTracker.loadTop();
        expect(top).to.be.eq(toBePushed);
      }
    });
  });
});
