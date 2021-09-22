## :warning:WARNING:warning:
This project is currently being audited and should not be deployed. It is not covered by the formal Element bug bounty program, bug reports are welcome though may not receive bounties. It is also in early access open source so should not be publicized or linked to externally.

# Council

[![Build Status](https://github.com/element-fi/council/workflows/Tests/badge.svg)](https://github.com/element-fi/council/actions)
[![Coverage Status](https://coveralls.io/repos/github/element-fi/council/badge.svg?branch=main&service=github&t=7FWsvc)](https://coveralls.io/github/element-fi/council?branch=main)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/element-fi/council/blob/master/LICENSE)

Council is a flexible smart contract governance architecture which allows a community to manage a DAO.

Council is inspired by and extends several forerunners in the DAO governance space including MakerDAO governance and the Compound governor contracts. Like these systems it is a fully onchain voting architecture which coordinates the process of making permissioned smart contract calls from privileged addresses. Council contains several architecture choices which make it distinct though: firstly council does not have a single security threshold to make a call, instead various actions can be given different security threshold requirements; secondly Council abstracts the vote allocation process away from the voting process meaning that multiple complex vote allocation systems can run in parallel in the contracts; finally by default Council ships with a governance steering council enabled which can be given different powers than the core voting system. Together these features mean a wide range of voting protocols and security procedures can be seamlessly integrated into one governance system.

Council is a community driven protocol and there are many ways to contribute to it, we encourage you to jump in and improve and use this code.

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
