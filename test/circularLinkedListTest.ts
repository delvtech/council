import { BigNumber } from "@ethersproject/contracts/node_modules/@ethersproject/bignumber";
import { TestCircularLinkedList } from "typechain/TestCircularLinkedList.d";
import { expect } from "chai";
import "module-alias/register";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, waffle } from "hardhat";

import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";

const { provider } = waffle;

describe("CircularLinkedList", function () {
  let signers: SignerWithAddress[];
  let linkedListContract: TestCircularLinkedList;

  before(async function () {
    await createSnapshot(provider);
    signers = await ethers.getSigners();

    const linkedListDeployer = await ethers.getContractFactory(
      "TestCircularLinkedList",
      signers[0]
    );

    linkedListContract = await linkedListDeployer.deploy();
  });

  after(async () => {
    await restoreSnapshot(provider);
  });

  beforeEach(async () => {
    await createSnapshot(provider);
  });
  afterEach(async () => {
    await restoreSnapshot(provider);
  });

  it("should not exist before items exist", async () => {
    const exists = await linkedListContract.exists();
    expect(exists).to.equal(false);
  });

  it("should push items", async () => {
    // true is after, push after to create HEAD <-> 1 <-> 2 <-> (back to HEAD)
    await linkedListContract.push(2, true);
    await linkedListContract.push(1, true);

    const exists = await linkedListContract.exists();
    expect(exists).to.equal(true);

    const node1 = await linkedListContract.getNode(1);
    // node returned as an array of links to PREV and NEXT nodes
    expect(node1).to.deep.equal([BigNumber.from(0), BigNumber.from(2)]);

    const node2 = await linkedListContract.getNode(2);
    // note that the NEXT node is the HEAD node at 0
    expect(node2).to.deep.equal([BigNumber.from(1), BigNumber.from(0)]);
  });

  it("should pop items", async () => {
    // false is before, push before to create 1 <-> 2 <-> HEAD <-> (back to 1)
    await linkedListContract.push(1, false);
    await linkedListContract.push(2, false);

    const sizeBeforePop = await linkedListContract.sizeOf();
    expect(sizeBeforePop).to.equal(2);

    const node = await linkedListContract.callStatic.pop(false);
    expect(node).to.deep.equal(BigNumber.from(2));

    await linkedListContract.pop(false);
    const sizeAfterPop = await linkedListContract.sizeOf();
    expect(sizeAfterPop).to.equal(1);
  });

  it("should insert items", async () => {
    // true is after, push after to create HEAD <-> 1 <-> 3 <-> (back to HEAD)
    await linkedListContract.push(3, false);
    await linkedListContract.push(1, false);

    const sizeBeforeInsert = await linkedListContract.sizeOf();
    expect(sizeBeforeInsert).to.equal(2);

    // true is after, insert 2 after 1 to create HEAD <-> 1 <-> 2 <-> 3 <-> (back to HEAD)
    await linkedListContract.insert(1, 2, true);
    const sizeAfterInsert = await linkedListContract.sizeOf();
    expect(sizeAfterInsert).to.equal(3);

    const node1 = await linkedListContract.getNode(1);
    // node returned as an array of links to PREV and NEXT nodes
    expect(node1).to.deep.equal([BigNumber.from(3), BigNumber.from(2)]);

    const node2 = await linkedListContract.getNode(2);
    // node returned as an array of links to PREV and NEXT nodes
    expect(node2).to.deep.equal([BigNumber.from(1), BigNumber.from(0)]);

    const node3 = await linkedListContract.getNode(3);
    // note that the NEXT node is the HEAD node at 0
    expect(node3).to.deep.equal([BigNumber.from(0), BigNumber.from(1)]);
  });

  it("should remove items", async () => {
    // true is after, push after to create HEAD <-> 1 <-> 2 <-> 3 <-> (back to 1)
    await linkedListContract.push(3, true);
    await linkedListContract.push(2, true);
    await linkedListContract.push(1, true);

    const sizeBeforeRemove = await linkedListContract.sizeOf();
    expect(sizeBeforeRemove).to.equal(3);

    // remove 3
    await linkedListContract.remove(3);
    const sizeAfterRemove = await linkedListContract.sizeOf();
    expect(sizeAfterRemove).to.equal(2);

    const node1 = await linkedListContract.getNode(1);
    // node returned as an array of links to PREV and NEXT nodes
    expect(node1).to.deep.equal([BigNumber.from(0), BigNumber.from(2)]);

    const node2 = await linkedListContract.getNode(2);
    // node returned as an array of links to PREV and NEXT nodes
    expect(node2).to.deep.equal([BigNumber.from(1), BigNumber.from(0)]);
  });
});
