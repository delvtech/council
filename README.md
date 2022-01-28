# Council

[![Build Status](https://github.com/element-fi/council/workflows/Tests/badge.svg)](https://github.com/element-fi/council/actions)
[![Coverage Status](https://coveralls.io/repos/github/element-fi/council/badge.svg?branch=main&t=ry86JL)](https://coveralls.io/github/element-fi/council?branch=main)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/element-fi/council/blob/master/LICENSE)
  
Council is a decentralized governance system that allows a community to manage a DAO. The governance system is designed to enable flexibility, improvements, and experimentation while successfully maintaining the security and robustness of the governed protocol.

Council is inspired by and extends several forerunners in the DAO governance space including MakerDAO's governance model and the Compound Governor contracts. Like these systems, it is a fully on-chain voting architecture that coordinates the process of making permissioned smart contract calls from privileged addresses. 

**Council contains several architectural choices which make it a distinct new primitive in the decentralized governance space:**
- Council does not have a single security threshold to make a call, instead, various actions can be given different security threshold requirements.
- Council abstracts the vote allocation process for assigning voting power away from the actual voting process meaning that multiple complex vote allocation systems can run in parallel in the contracts. 
- By default, Council ships with a Governance Steering Council (GSC) enabled which can be assigned different powers than the core voting system. 
Together, these features allow a wide range of voting processes and security procedures can be seamlessly integrated into one governance system.

## Bug Reporting

For both non-security-critical bugs and security-related critical bugs please follow the rules and instructions highlighted in the Element Finance Bug Bounty program on the [Immunefi platform](https://immunefi.com/bounty/elementfinance/).

## Contributing to Council

Council is a community-driven governance protocol and there are many ways to contribute to it. We encourage you to jump in and improve and use this code whether that be contributing to Council directly, forking the governance framework for your own use, or just taking bits and pieces from it. We want everyone to build with us!

If you have a suggestion for a new feature, extension, or cool use case and want to help the community, drop by the #developers channel in our [discord](https://discord.gg/srgcTGccGe) to discuss and you will have a warm welcome!

When contributing, please be sure to follow our contribution [guidelines](https://github.com/element-fi/elf-contracts/blob/master/CONTRIBUTING.md) when proposing any new code. Lastly, because Council is a community-driven governance protocol, any new code contributions are more likely to be accepted into future deployments of the protocol if they have been openly discussed within the community first.

For a technical overview of Council's smart contracts, please read our documentation [here](https://docs.element.fi/governance-council/council-protocol-smart-contracts).

### Architecture Overview Diagram
![image](https://user-images.githubusercontent.com/32653033/135169921-9a295182-88fc-4b53-b6c4-3d29cf41f71c.png)

## Build and Testing

### 1. Getting Started (Prerequisites)

- [Install npm](https://nodejs.org/en/download/)

### 2. Setup

```
git clone git@github.com:element-fi/council.git
```

```
cd council
npm install
```

### 3. Build

```
npm run build
```

### 4. Test

```
npm run test
```

## Contributing 
Council is a community-driven protocol and there are many ways to contribute to it. We encourage anyone to use this as their protocol or DAOs governance system. If you are interested in building on top of it, improving the code, please do! 

## Support 
If you have any questions, feedback, ideas for improvement, or even further experiments to test out with Council, come join our [#governance](https://discord.gg/z4EsSuaYCd) discord channel to talk more about this!
