import { createCallHash } from "../../timelockTest";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Governance, loadGovernance } from "./deploy";
import { ethers, waffle } from "hardhat";
import timelockData from "../../../artifacts/contracts/features/Timelock.sol/Timelock.json";
import proxyData from "../../../artifacts/contracts/simpleProxy.sol/SimpleProxy.json";
import coreVotingData from "../../../artifacts/contracts/CoreVoting.sol/CoreVoting.json";
import { Account, getMerkleTree, hashAccount } from "../../helpers/merkle";
import { id } from "ethers/lib/utils";
import { expect } from "chai";
import { promises } from "fs";
import { SimpleProxy } from "../../../typechain/SimpleProxy";
import {
  advanceTime,
  advanceBlocks,
  getBlock,
  getTimestamp,
} from "../../helpers/time";

export interface RunnerInput {
  governance: Governance;
  signers: SignerWithAddress[];
  votingVaults: string[];
  cvExtraData: string[];
  cvTargets: string[];
  cvCalldatas: string[];
  tlCallHash: string;
  tlCalldatas: string[];
  tLTargets: string[];
  ballot: number;
  proposalID: number;
  description: string;
  checks: (() => Promise<void>)[];
}
const { provider } = waffle;
const [wallet] = provider.getWallets();

export const RunnerInputs = {
  input1: async (
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

    const checkValues = [
      //check wait time
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
      cvExtraData: ["0x00", "0x00", extraData],
      cvTargets: [governance.timelock.address],
      cvCalldatas: [calldataCv],
      tlCallHash: callHash,
      tlCalldatas: [calldataTl],
      tLTargets: [governance.timelock.address],
      ballot: 0,
      proposalID: 0,
      description: "update timelock wait time",
      checks: checkValues,
    };
  },
  // setFailHash: async (governance: Governance, signers: SignerWithAddress[]): Promise<RunnerInput> => {
  //   const one = ethers.utils.parseEther("1");
  //   const newWaitTime = 123456;
  //   const tInterface = new ethers.utils.Interface(timelockData.abi);

  //   // Setup calldata for timelock's setTime function.

  //   const data = tInterface.encodeFunctionData("setWaitTime", [
  //     newWaitTime,
  //   ]);
  //   // get the callhash
  //   const paramhash = await createCallHash([data], [governance.timelock.address]);
  //   const calldataTl = tInterface.encodeFunctionData("stopCall", [
  //     paramhash,
  //   ]);
  //   // calldata for the coreVoting contract
  //   const callHash = tInterface.encodeFunctionData("stopCall", [
  //     callHash,
  //   ]);

  //   const proof = governance.merkle.getHexProof(await hashAccount({
  //     address: signers[0].address,
  //     value: one
  //   }));
  //   const extraData = ethers.utils.defaultAbiCoder.encode(
  //     ["uint256", "bytes32[]"],
  //     [one, proof]
  //   );

  //   let checkValues = [
  //     //check wait time
  //     async () => {
  //       let waittime = (await governance.timelock.waitTime()).toNumber()
  //       expect(waittime).to.equal(newWaitTime)
  //     }
  //   ]

  //   return {
  //     governance: governance,
  //     signers: signers,
  //     votingVaults: [
  //       governance.lockingVault.address,
  //       governance.vestingVault.address,
  //       governance.rewards.address,
  //     ],
  //     cvExtraData: ["0x00", "0x00", extraData],
  //     cvTargets: [governance.timelock.address],
  //     cvCalldatas: [calldataCv],
  //     tlCallHash: callHash,
  //     tlCalldatas: [calldataTl],
  //     tLTargets: [governance.timelock.address],
  //     ballot: 0,
  //     proposalID: 0,
  //     description: "update timelock wait time",
  //     checks: checkValues
  //   }
  // },
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

    const checkValues = [
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
    //let ret = JSON.parse(JSON.stringify(inputs))
    //ret.governance = governance
    //ret.checks = checkValues
    //ret.description = "update vesting vault"
    return {
      governance: governance,
      signers: signers,
      votingVaults: [
        governance.lockingVault.address,
        governance.vestingVault.address,
        governance.rewards.address,
      ],
      cvExtraData: inputs.cvExtraData,
      cvTargets: [governance.timelock.address],
      cvCalldatas: [calldataCv],
      tlCallHash: callHash,
      tlCalldatas: [calldataTl],
      tLTargets: targets,
      ballot: 0,
      proposalID: 0,
      description: "upgradeVestigVault",
      checks: checkValues,
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

    const checkValues = [
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
    //let ret = JSON.parse(JSON.stringify(inputs))
    //ret.governance = governance
    //ret.checks = checkValues
    //ret.description = "update vesting vault"
    return {
      governance: governance,
      signers: signers,
      votingVaults: [
        governance.lockingVault.address,
        governance.vestingVault.address,
        governance.rewards.address,
      ],
      cvExtraData: inputs.cvExtraData,
      cvTargets: [governance.timelock.address],
      cvCalldatas: [calldataCv],
      tlCallHash: callHash,
      tlCalldatas: [calldataTl],
      tLTargets: targets,
      ballot: 0,
      proposalID: 0,
      description: "upgradeLockingVault",
      checks: checkValues,
    };
  },
};

export async function getInputs(
  governance: Governance,
  signers: SignerWithAddress[]
) {
  let inputs: RunnerInput[];

  const input1 = await RunnerInputs.input1(governance, signers);

  return [input1];
}
