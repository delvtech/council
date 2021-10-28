import { ethers, network, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Account, getMerkleTree, hashAccount } from "../../helpers/merkle";
import { advanceTime } from "../../helpers/time";

import { CoreVoting } from "../../../typechain/CoreVoting";
import { GSCVault } from "../../../typechain/GSCVault";
import { SimpleProxy } from "../../../typechain/SimpleProxy";
import { MockERC20 } from "../../../typechain/MockERC20";
import { Timelock } from "../../../typechain/Timelock";
import { VestingVault } from "../../../typechain/VestingVault";
import { OptimisticRewards } from "../../../typechain/OptimisticRewards";
import { LockingVault } from "../../../typechain/LockingVault";
import { Spender } from "../../../typechain/Spender";
import { Treasury } from "../../../typechain/Treasury";
import { expect } from "chai";
import MerkleTree from "merkletreejs";

export interface Governance {
  token: MockERC20;
  coreVoting: CoreVoting;
  timelock: Timelock;
  vestingVault: VestingVault;
  lockingVault: LockingVault;
  gscVault: GSCVault;
  gscCoreVoting: CoreVoting;
  rewards: OptimisticRewards;
  spender: Spender;
  treasury: Treasury;
  merkle: MerkleTree;
}

const { provider } = waffle;

async function timestamp() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}
async function blockNumber() {
  return (await ethers.provider.getBlock("latest")).number;
}
export async function loadGovernance(signers: SignerWithAddress[]) {
  // init vars
  const one = ethers.utils.parseEther("1");
  const two = ethers.utils.parseEther("2");
  const three = ethers.utils.parseEther("3");
  const ten = ethers.utils.parseEther("10");

  const { provider } = waffle;
  const [wallet] = provider.getWallets();

  const accounts = [];
  for (const i in signers) {
    accounts.push({
      address: signers[i].address,
      value: one,
    });
  }

  const merkle = await getMerkleTree(accounts);

  // deployers
  const erc20Deployer = await ethers.getContractFactory(
    "MockERC20",
    signers[0]
  );
  const coreVotingDeployer = await ethers.getContractFactory(
    "CoreVoting",
    signers[0]
  );
  const proxyDeployer = await ethers.getContractFactory("SimpleProxy", wallet);
  const gscDeployer = await ethers.getContractFactory("GSCVault", signers[0]);
  const timelockDeployer = await ethers.getContractFactory(
    "Timelock",
    signers[0]
  );
  const vestingVaultDeployer = await ethers.getContractFactory(
    "VestingVault",
    signers[0]
  );

  const airdropDeployer = await ethers.getContractFactory(
    "OptimisticRewards",
    signers[0]
  );
  const lockingVaultDeployer = await ethers.getContractFactory(
    "LockingVault",
    signers[0]
  );
  const spenderDeployer = await ethers.getContractFactory(
    "Spender",
    signers[0]
  );
  const treasuryDeployer = await ethers.getContractFactory(
    "Treasury",
    signers[0]
  );

  // deployments
  const token = await erc20Deployer.deploy("Ele", "test ele");

  // setup coreVoting with no vaults. change these + the timelock later
  const coreVoting = await coreVotingDeployer.deploy(
    signers[0].address,
    ten,
    three,
    ethers.constants.AddressZero,
    []
  );

  // deploy a new copy of coreVoting for the gsc to use.
  // set quorum to be all available signers, and the minimum voting power
  // to be 1 so any gsc member can propose
  const gscCoreVoting = await coreVotingDeployer.deploy(
    signers[0].address,
    signers.length,
    1,
    ethers.constants.AddressZero,
    []
  );
  // add signers[0] address for governance and gsc vault. To be updated later.
  const timelock = await timelockDeployer.deploy(
    1000,
    signers[0].address,
    signers[0].address
  );

  // VAULTS
  // setup vesting vault proxy
  const vestingVaultBase = await vestingVaultDeployer.deploy(
    token.address,
    199350
  );
  const vestingVaultProxy = await proxyDeployer.deploy(
    timelock.address,
    vestingVaultBase.address
  );
  const vestingVault = await vestingVaultBase.attach(vestingVaultProxy.address);
  await vestingVault.initialize(signers[0].address, timelock.address);

  // setup locking vault proxy
  const lockingVaultBase = await lockingVaultDeployer.deploy(
    token.address,
    199350
  );
  const lockingVaultProxy = await proxyDeployer.deploy(
    timelock.address,
    lockingVaultBase.address
  );
  const lockingVault = lockingVaultBase.attach(lockingVaultProxy.address);

  // get the gsc vault, three voting power bound.
  const gscVault = await gscDeployer.deploy(
    coreVoting.address,
    three,
    timelock.address
  );

  // setup optimistic rewards vault
  const rewards = await airdropDeployer.deploy(
    coreVoting.address,
    merkle.getHexRoot(),
    signers[0].address,
    signers[0].address,
    token.address,
    lockingVault.address
  );

  // add approved governance vaults. Signers[0] is still the timelock so we can change this
  await coreVoting
    .connect(signers[0])
    .changeVaultStatus(vestingVault.address, true);
  await coreVoting
    .connect(signers[0])
    .changeVaultStatus(lockingVault.address, true);
  await coreVoting.connect(signers[0]).changeVaultStatus(rewards.address, true);

  // add approved governance vault for the GSC core voting. Just the GSC vault in this case
  await gscCoreVoting
    .connect(signers[0])
    .changeVaultStatus(gscVault.address, true);

  // deploy spender
  const spender = await spenderDeployer.deploy(
    timelock.address,
    coreVoting.address,
    token.address,
    one,
    two,
    three
  );

  const treasury = await treasuryDeployer.deploy(timelock.address);

  const now = await timestamp();

  //fund the vesting vault
  await token.setBalance(signers[0].address, ten);
  await token.connect(signers[0]).approve(vestingVault.address, ten);
  await vestingVault.connect(signers[0]).deposit(ten);

  // give voting power to each address for the remaining vaults (vesting GSC Locking)
  for (const i in signers) {
    await token.setBalance(signers[i].address, three);

    const proof = merkle.getHexProof(await hashAccount(accounts[i]));
    const extraData = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bytes32[]"],
      [one, proof]
    );
    await token.connect(signers[i]).approve(lockingVault.address, one);
    await lockingVault
      .connect(signers[i])
      .deposit(signers[i].address, one, signers[i].address);
    await vestingVault
      .connect(signers[0])
      .addGrantAndDelegate(
        signers[i].address,
        one,
        now,
        now + 31000000,
        1000000,
        signers[i].address
      );
    await gscVault
      .connect(signers[i])
      .proveMembership(
        [lockingVault.address, vestingVault.address, rewards.address],
        ["0x", "0x", extraData]
      );
  }
  // fast forward idle duration for gsc members
  const idleDuration = await gscVault.idleDuration();
  advanceTime(provider, idleDuration.toNumber());

  // make sure that the GSC members were added. This checks that the members were added to all
  // the other vaults as well because GSC entry requirements require the votes from all 3 vaults.
  for (const i in signers) {
    const powerGsc = await gscVault
      .connect(signers[i])
      .queryVotePower(signers[i].address, 1234, "0x00");
    if (powerGsc.toNumber() != 1) {
      throw new Error("GSC member not added");
    }
  }

  // fund spender contract
  await token.setBalance(spender.address, ten);

  // fund treasury contract ETH + ERC20
  await token.setBalance(treasury.address, ten);
  signers[0].sendTransaction({
    to: treasury.address,
    value: one,
  });

  // authorize gsc vault and change owner to be the coreVoting contract
  await coreVoting.connect(signers[0]).authorize(gscCoreVoting.address);
  await coreVoting.connect(signers[0]).setOwner(timelock.address);

  // set timelock values now
  await timelock.connect(signers[0]).deauthorize(signers[0].address);
  await timelock.connect(signers[0]).authorize(gscCoreVoting.address);
  await timelock.connect(signers[0]).setOwner(coreVoting.address);

  // authorize gsc vault and set timelock address to the real timelock
  await gscCoreVoting.connect(signers[0]).setOwner(timelock.address);

  return {
    token,
    coreVoting,
    timelock,
    vestingVault,
    lockingVault,
    gscVault,
    gscCoreVoting,
    rewards,
    spender,
    treasury,
    merkle,
  };
}

export async function upgradeTimelock(
  signers: SignerWithAddress[],
  governance: Governance
) {
  const timelockDeployer = await ethers.getContractFactory(
    "Timelock",
    signers[0]
  );
  // add signers[0] address for governance and gsc vault. To be updated later.
  const timelock = await timelockDeployer.deploy(
    1000,
    governance.coreVoting.address,
    governance.gscVault.address
  );
}
