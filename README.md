## :warning:WARNING:warning:
The Council governance codebase is currently being audited and should **not** be deployed. The project is currently in the early stages of being open-sourced and should therefore not be publicized or linked to externally. It is important to note that this codebase is not covered by the [formal Element bug bounty program](https://immunefi.com/bounty/elementfinance/). However, bug reports are welcome though may not receive bounties. 

# Council

[![Build Status](https://github.com/element-fi/council/workflows/Tests/badge.svg)](https://github.com/element-fi/council/actions)
[![Coverage Status](https://coveralls.io/repos/github/element-fi/council/badge.svg?branch=main&service=github&t=7FWsvc)](https://coveralls.io/github/element-fi/council?branch=main)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/element-fi/council/blob/master/LICENSE)
  
Council is a decentralized governance system that allows a community to manage a DAO. The governance system is designed to enable flexibility, improvements, and experimentation while successfully maintaining the security and robustness of the governed protocol.

Council is inspired by and extends several forerunners in the DAO governance space including MakerDAO's governance model and the Compound Governor contracts. Like these systems, it is a fully on-chain voting architecture that coordinates the process of making permissioned smart contract calls from privileged addresses. 

**Council contains several architectural choices which make it a distinct new primitive in the decentralized governance space:**
- Council does not have a single security threshold to make a call, instead, various actions can be given different security threshold requirements.
- Council abstracts the vote allocation process for assigning voting power away from the actual voting process meaning that multiple complex vote allocation systems can run in parallel in the contracts. 
- By default, Council ships with a Governance Steering Council (GSC) enabled which can be assigned different powers than the core voting system. 
Together, these features allow a wide range of voting processes and security procedures can be seamlessly integrated into one governance system.

### Architecture Overview Diagram
![image](https://user-images.githubusercontent.com/32653033/135169921-9a295182-88fc-4b53-b6c4-3d29cf41f71c.png)


## Build and Testing

### 1. Getting Started (Prerequisites)

- [Install npm](https://nodejs.org/en/download/)

### 2. Setup

```
git clone git@github.com:element-fi/elf-contracts.git
```

```
cd elf-contracts
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
