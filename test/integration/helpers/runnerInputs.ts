import { createCallHash } from "../../timelockTest";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Governance } from "./deploy";
import { ethers, waffle } from "hardhat";
import coreVotingData from "../../../artifacts/contracts/CoreVoting.sol/CoreVoting.json";
import gscVaultData from "../../../artifacts/contracts/vaults/GSCVault.sol/GSCVault.json";
import timelockData from "../../../artifacts/contracts/features/Timelock.sol/Timelock.json";
import proxyData from "../../../artifacts/contracts/simpleProxy.sol/SimpleProxy.json";
import { hashAccount } from "../../helpers/merkle";
import { expect } from "chai";
import { getBlock } from "../../helpers/time";
import { Timelock } from "../../../typechain/Timelock";
import { CoreVoting } from "../../../typechain";

export interface RunnerInput {
  governance: Governance; // holds governance core contracts
  signers: SignerWithAddress[]; // signers to use
  votingVaults: string[]; // voting vaults the coreVoting contract uses
  coreVotingExtraData: string[]; // extra data for the coreVoting contract
  coreVotingTargets: string[]; // targets for the CoreVoting contract
  coreVotingCalldatas: string[]; // calldatas for the CoreVoting contract
  timelockCallHash: string; // callhash for the timelock contract
  timelockCalldatas: string[]; // calldatas for the timelock contract
  timelockTargets: string[]; // targets for the timelock contract
  ballot: number; // vote direction
  proposalID: number; // holds the ID fo the proposal. Does not need to be set on input creation
  description: string; // description of the input
  checks: (() => Promise<void>)[]; // checks th run that ensures the input was successful ran
}
const { provider } = waffle;
const [wallet] = provider.getWallets();

export const RunnerInputs = {
  updateWaitTimeInput: async (
    governance: Governance,
    signers: SignerWithAddress[]
  ): Promise<RunnerInput> => {
    const one = ethers.utils.parseEther("1");
    const newWaitTime = 123456;
    const tInterface = new ethers.utils.Interface(timelockData.abi);

    //setup calldata for timelock's setTime function.
    const calldataTl = tInterface.encodeFunctionData("setWaitTime", [
      newWaitTime,
    ]);
    // get the callhash
    const callHash = await createCallHash(
      [calldataTl],
      [governance.timelock.address]
    );
    // calldata for the coreVoting contract
    const calldataCv = tInterface.encodeFunctionData("registerCall", [
      callHash,
    ]);

    // proof for extraData for the rewards vault
    const proof = governance.merkle.getHexProof(
      await hashAccount({
        address: signers[0].address,
        value: one,
      })
    );

    const extraData = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bytes32[]"],
      [one, proof]
    );

    const checks = [
      // check wait time was successfully updated
      async () => {
        const waittime = (await governance.timelock.waitTime()).toNumber();
        expect(waittime).to.equal(newWaitTime);
      },
    ];
    return {
      governance: governance,
      signers: signers,
      votingVaults: [
        governance.lockingVault.address,
        governance.vestingVault.address,
        governance.rewards.address,
      ],
      coreVotingExtraData: ["0x00", "0x00", extraData],
      coreVotingTargets: [governance.timelock.address],
      coreVotingCalldatas: [calldataCv],
      timelockCallHash: callHash,
      timelockCalldatas: [calldataTl],
      timelockTargets: [governance.timelock.address],
      ballot: 0,
      proposalID: 0,
      description: "update timelock wait time",
      checks,
    };
  },
  gscProposalSubmit: async (
    governance: Governance,
    signers: SignerWithAddress[]
  ): Promise<RunnerInput> => {
    const newIdle = 12345;
    const tInterface = new ethers.utils.Interface(timelockData.abi);
    const cvInterface = new ethers.utils.Interface(coreVotingData.abi);
    const gscInterface = new ethers.utils.Interface(gscVaultData.abi);

    // function that timelock will run
    const calldataTl = gscInterface.encodeFunctionData("setIdleDuration", [
      newIdle,
    ]);

    // get the callhash
    const callHash = await createCallHash(
      [calldataTl],
      [governance.gscVault.address]
    );

    // calldata for the coreVoting contract
    const calldataCv = tInterface.encodeFunctionData("registerCall", [
      callHash,
    ]);

    const calldataPropose = cvInterface.encodeFunctionData("proposal", [
      [],
      [],
      [governance.timelock.address],
      [calldataCv],
      0,
    ]);

    return {
      governance: governance,
      signers: signers,
      votingVaults: [governance.gscVault.address],
      coreVotingExtraData: ["0x00"],
      coreVotingTargets: [governance.coreVoting.address],
      coreVotingCalldatas: [calldataPropose],
      timelockCallHash: callHash,
      timelockCalldatas: [calldataTl],
      timelockTargets: [governance.timelock.address],
      ballot: 0,
      proposalID: 1,
      description: "submit coreVoting proposal from gscCoreVoting",
      checks: [],
    };
  },
  gscProposalPass: async (
    governance: Governance,
    signers: SignerWithAddress[]
  ): Promise<RunnerInput> => {
    const one = ethers.utils.parseEther("1");
    const newIdle = 12345;
    const tInterface = new ethers.utils.Interface(timelockData.abi);
    const gscInterface = new ethers.utils.Interface(gscVaultData.abi);

    // function that timelock will run
    const calldataTl = gscInterface.encodeFunctionData("setIdleDuration", [
      newIdle,
    ]);

    // get the callhash
    const callHash = await createCallHash(
      [calldataTl],
      [governance.gscVault.address]
    );

    // calldata for the coreVoting contract
    const calldataCv = tInterface.encodeFunctionData("registerCall", [
      callHash,
    ]);

    const proof = governance.merkle.getHexProof(
      await hashAccount({
        address: signers[0].address,
        value: one,
      })
    );
    const extraData = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bytes32[]"],
      [one, proof]
    );

    const checks = [
      //check wait time
      async () => {
        const idle = (await governance.gscVault.idleDuration()).toNumber();
        expect(idle).to.equal(newIdle);
      },
    ];

    return {
      governance: governance,
      signers: signers,
      votingVaults: [
        governance.lockingVault.address,
        governance.vestingVault.address,
        governance.rewards.address,
      ],
      coreVotingExtraData: ["0x00", "0x00", extraData],
      coreVotingTargets: [governance.timelock.address],
      coreVotingCalldatas: [calldataCv],
      timelockCallHash: callHash,
      timelockCalldatas: [calldataTl],
      timelockTargets: [governance.gscVault.address],
      ballot: 0,
      proposalID: 2,
      description: "pass coreVoting proposal from gscCoreVoting",
      checks,
    };
  },
  increaseWaitTime: async (
    governance: Governance,
    signers: SignerWithAddress[]
  ): Promise<RunnerInput> => {
    const tInterface = new ethers.utils.Interface(timelockData.abi);
    const callHash =
      "0x1234567800000000000000000000000000000000000000000000000000000000";
    const timeValue = 12345;
    // function that timelock will run

    const calldataCv = tInterface.encodeFunctionData("increaseTime", [
      timeValue,
      callHash,
    ]);
    const checks = [
      //check wait time
      async () => {
        const timeIncrease = await governance.timelock.timeIncreases(callHash);
        const waitTime = await governance.timelock.callTimestamps(callHash);
        expect(timeIncrease).to.equal(true);
        expect(waitTime.toNumber()).to.equal(timeValue);
      },
    ];
    return {
      governance: governance,
      signers: signers,
      votingVaults: [governance.gscVault.address],
      coreVotingExtraData: ["0x00"],
      coreVotingTargets: [governance.timelock.address],
      coreVotingCalldatas: [calldataCv],
      timelockCallHash: callHash,
      timelockCalldatas: ["0x00"],
      timelockTargets: [ethers.constants.AddressZero],
      ballot: 0,
      proposalID: 0,
      description: "increase timelock time value from GSC Core Voting",
      checks,
    };
  },
};

export const RunnerMods = {
  upgradeVestingVault: async (
    governance: Governance,
    signers: SignerWithAddress[],
    inputs: RunnerInput
  ): Promise<RunnerInput> => {
    const tInterface = new ethers.utils.Interface(timelockData.abi);
    const pInterface = new ethers.utils.Interface(proxyData.abi);

    const proxyDeployer = await ethers.getContractFactory(
      "SimpleProxy",
      wallet
    );
    const vestingVaultDeployer = await ethers.getContractFactory(
      "VestingVault",
      signers[0]
    );

    // deploy vesting vault
    const vestingVaultNew = await vestingVaultDeployer.deploy(
      governance.token.address,
      199350
    );
    // get the proxy
    const proxy = await proxyDeployer.attach(governance.vestingVault.address);

    //setup calldata for timelock's setTime function.
    const calldataTl = pInterface.encodeFunctionData("upgradeProxy", [
      vestingVaultNew.address,
    ]);
    // get the callhash
    const targets = [governance.vestingVault.address];
    const callHash = await createCallHash([calldataTl], targets);

    // calldata for the coreVoting contract
    const calldataCv = tInterface.encodeFunctionData("registerCall", [
      callHash,
    ]);

    const checks = [
      //check wait time
      async () => {
        const block = await getBlock(provider);
        const newImp = await proxy.proxyImplementation();
        expect(newImp).to.equal(vestingVaultNew.address);
        for (const i in signers) {
          const vp = await governance.vestingVault.queryVotePowerView(
            signers[i].address,
            block
          );
          expect(vp).to.equal(ethers.utils.parseEther("1"));
        }
      },
    ];

    return {
      governance: governance,
      signers: signers,
      votingVaults: [
        governance.lockingVault.address,
        governance.vestingVault.address,
        governance.rewards.address,
      ],
      coreVotingExtraData: inputs.coreVotingExtraData,
      coreVotingTargets: [governance.timelock.address],
      coreVotingCalldatas: [calldataCv],
      timelockCallHash: callHash,
      timelockCalldatas: [calldataTl],
      timelockTargets: targets,
      ballot: 0,
      proposalID: 0,
      description: "upgradeVestigVault",
      checks,
    };
  },
  upgradeLockingVault: async (
    governance: Governance,
    signers: SignerWithAddress[],
    inputs: RunnerInput
  ): Promise<RunnerInput> => {
    const tInterface = new ethers.utils.Interface(timelockData.abi);
    const pInterface = new ethers.utils.Interface(proxyData.abi);

    const proxyDeployer = await ethers.getContractFactory(
      "SimpleProxy",
      wallet
    );
    const lockingVaultDeployer = await ethers.getContractFactory(
      "LockingVault",
      signers[0]
    );

    // deploy vesting vault
    const lockingVaultNew = await lockingVaultDeployer.deploy(
      governance.token.address,
      199350
    );
    // get the proxy
    const proxy = await proxyDeployer.attach(governance.lockingVault.address);

    //setup calldata for timelock's setTime function.
    const calldataTl = pInterface.encodeFunctionData("upgradeProxy", [
      lockingVaultNew.address,
    ]);
    // get the callhash
    const targets = [governance.lockingVault.address];
    const callHash = await createCallHash([calldataTl], targets);

    // calldata for the coreVoting contract
    const calldataCv = tInterface.encodeFunctionData("registerCall", [
      callHash,
    ]);

    const checks = [
      //check wait time
      async () => {
        const block = await getBlock(provider);
        const newImp = await proxy.proxyImplementation();
        expect(newImp).to.equal(lockingVaultNew.address);
        for (const i in signers) {
          const vp = await governance.lockingVault.queryVotePowerView(
            signers[i].address,
            block
          );
          expect(vp).to.equal(ethers.utils.parseEther("1"));
        }
      },
    ];
    return {
      governance: governance,
      signers: signers,
      votingVaults: [
        governance.lockingVault.address,
        governance.vestingVault.address,
        governance.rewards.address,
      ],
      coreVotingExtraData: inputs.coreVotingExtraData,
      coreVotingTargets: [governance.timelock.address],
      coreVotingCalldatas: [calldataCv],
      timelockCallHash: callHash,
      timelockCalldatas: [calldataTl],
      timelockTargets: targets,
      ballot: 0,
      proposalID: 0,
      description: "upgradeLockingVault",
      checks,
    };
  },
  upgradeCoreVoting: async (
    governance: Governance,
    signers: SignerWithAddress[],
    inputs: RunnerInput
  ): Promise<RunnerInput> => {
    const three = ethers.utils.parseEther("3");
    const ten = ethers.utils.parseEther("10");
    const tInterface = new ethers.utils.Interface(timelockData.abi);

    const coreVotingDeployer = await ethers.getContractFactory(
      "CoreVoting",
      signers[0]
    );

    // deploy new CoreVoting contract with correct params
    const coreVotingNew = await coreVotingDeployer.deploy(
      governance.timelock.address,
      ten,
      three,
      governance.gscCoreVoting.address,
      inputs.votingVaults
    );
    // calldata for the coreVoting contract. Should set the new coreVoting contract to owner
    const calldataCv = tInterface.encodeFunctionData("setOwner", [
      coreVotingNew.address,
    ]);

    const checks = [
      // successful if the new voting vault is the owner of the timelock
      async () => {
        const owner = await governance.timelock.owner();
        expect(owner).to.equal(coreVotingNew.address);
        governance.coreVoting = coreVotingNew;
      },
    ];
    return {
      governance: governance,
      signers: signers,
      votingVaults: [
        governance.lockingVault.address,
        governance.vestingVault.address,
        governance.rewards.address,
      ],
      coreVotingExtraData: inputs.coreVotingExtraData,
      coreVotingTargets: [governance.timelock.address],
      coreVotingCalldatas: [calldataCv],
      timelockCallHash: "0x00",
      timelockCalldatas: ["0x00"],
      timelockTargets: [ethers.constants.AddressZero],
      ballot: 0,
      proposalID: 0,
      description: "upgrade CoreVoting contract",
      checks,
    };
  },
  upgradeTimelock: async (
    governance: Governance,
    signers: SignerWithAddress[],
    inputs: RunnerInput,
    timelock?: Timelock,
    targetTimelock?: Timelock
  ): Promise<RunnerInput> => {
    const tInterface = new ethers.utils.Interface(timelockData.abi);
    const cvInterface = new ethers.utils.Interface(coreVotingData.abi);

    const timelockValue = await (async function () {
      if (timelock !== undefined) return timelock;
      const timelockDeployer = await ethers.getContractFactory(
        "Timelock",
        signers[0]
      );
      // deploy new timelock contract with correct params
      return await timelockDeployer.deploy(
        1000,
        governance.coreVoting.address,
        governance.gscCoreVoting.address
      );
    })();
    const timelockTarget = await (async function () {
      if (targetTimelock !== undefined) return targetTimelock;
      return timelockValue;
    })();
    // if we are calling from the GSC Core Voting contract,
    // we need to old timelock to call setOwner
    governance.timelock =
      timelock !== undefined ? timelockTarget : governance.timelock;
    const cvTarget: CoreVoting =
      timelock !== undefined ? governance.coreVoting : governance.gscCoreVoting;

    const calldataTl = cvInterface.encodeFunctionData("setOwner", [
      timelockValue.address,
    ]);
    // get the callhash
    const timelockCallHash = await createCallHash(
      [calldataTl],
      [cvTarget.address]
    );

    // CoreVoting should register the call with Timelock
    const calldataCv = tInterface.encodeFunctionData("registerCall", [
      timelockCallHash,
    ]);
    const checks = [
      // successful if the new voting vault is the owner of the timelock
      async () => {
        const owner = await cvTarget.owner();
        expect(owner).to.equal(timelockValue.address);
        governance.timelock = timelockValue;
      },
    ];
    return {
      governance: governance,
      signers: signers,
      votingVaults: inputs.votingVaults,
      coreVotingExtraData: inputs.coreVotingExtraData,
      coreVotingTargets: [governance.timelock.address],
      coreVotingCalldatas: [calldataCv],
      timelockCallHash,
      timelockCalldatas: [calldataTl],
      timelockTargets: [cvTarget.address],
      ballot: 0,
      proposalID: 0,
      description: "upgrade Timelock contract",
      checks,
    };
  },
};
