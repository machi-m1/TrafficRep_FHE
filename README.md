# Private Traffic Violation Reporting (TrafficRep_FHE)

TrafficRep_FHE is a privacy-preserving application that leverages Zama's Fully Homomorphic Encryption (FHE) technology to anonymize and secure the reporting of traffic violations. By employing advanced cryptographic techniques, we empower citizens to report incidents with complete confidence, ensuring their identity remains protected while simultaneously allowing law enforcement to verify the authenticity of crucial data.

## The Problem

In today’s digital landscape, the handling of sensitive information like traffic violation data poses significant privacy and security risks. Conventional reporting systems often expose personal data, leaving individuals vulnerable to potential misuse and unwarranted scrutiny. This cleartext data can be intercepted, causing not only personal distress but also compromising the integrity of the reporting process. There is an urgent need for a solution that allows for secure reporting while safeguarding individual identities from prying eyes.

## The Zama FHE Solution

Zama FHE addresses these privacy concerns directly by enabling computations on encrypted data. Using Zama's fhevm to process encrypted inputs, TrafficRep_FHE guarantees that even while law enforcement officials verify reports, the identities of those reporting remain confidential. This means that sensitive data such as video evidence can be securely uploaded and verified without ever revealing the reporter's identity or the underlying content in cleartext.

## Key Features

- 🔒 **Anonymized Reporting:** Citizens can report traffic violations without revealing their identities, ensuring personal privacy.
- 🎥 **Encrypted Video Uploads:** Traffic violations can be recorded and submitted as encrypted video files, maintaining confidentiality throughout the process.
- ⏱️ **Homomorphic Validation:** Law enforcement can verify the timing and location of reported incidents through homomorphic calculations on encrypted data.
- 👁️ **Citizen Oversight:** Encourages public participation in traffic law enforcement while protecting individual privacy.
- 🛡️ **Identity Protection:** Protects the identity of users throughout the reporting and verification process, fostering trust between citizens and law enforcement.

## Technical Architecture & Stack

TrafficRep_FHE is built with a robust technology stack focused on privacy and security:

- **Core Privacy Engine:** Zama's FHE technology (fhevm)
- **Front-end:** JavaScript, HTML, CSS
- **Back-end:** Node.js, Express
- **Database:** MongoDB
- **Cryptography:** Zama's FHE library for encryption and decryption of reports

## Smart Contract / Core Logic

The application includes a smart contract written in Solidity to handle the core logic of the traffic violation reporting process. Below is a simplified example demonstrating how encrypted reports can be processed:

```solidity
pragma solidity ^0.8.0;

contract TrafficRep {
    struct Report {
        uint64 timestamp;
        bytes videoHash; // Encrypted video hash
    }

    mapping(address => Report) public reports;

    function submitReport(uint64 _timestamp, bytes memory _videoHash) public {
        reports[msg.sender] = Report(_timestamp, _videoHash);
    }

    function verifyReport(address _reporter) public view returns (uint64, bytes memory) {
        return (reports[_reporter].timestamp, reports[_reporter].videoHash);
    }
}
```

This smart contract allows users to submit encrypted reports while maintaining their anonymity, enabling secure verification by authorities.

## Directory Structure

The project's directory structure follows a clean and organized layout to facilitate development:

```
TrafficRep_FHE/
├── contracts/
│   └── TrafficRep.sol
├── src/
│   ├── index.js
│   ├── upload.js
│   └── verify.js
├── public/
│   ├── index.html
│   └── style.css
├── models/
│   └── reportModel.js
├── tests/
│   └── TrafficRep.test.js
└── README.md
```

## Installation & Setup

### Prerequisites

To get started, ensure you have the following installed:

- Node.js
- npm or yarn
- MongoDB

### Installation Steps

1. Install the necessary dependencies:

   ```bash
   npm install
   ```

2. Install the Zama library for Fully Homomorphic Encryption:

   ```bash
   npm install fhevm
   ```

3. Ensure your MongoDB instance is running.

## Build & Run

After installation, you can build and run the application using the following commands:

```bash
npx hardhat compile
npm start
```

This will compile the smart contract and start the Node.js server, making the application accessible for reporting traffic violations.

## Acknowledgements

We would like to express our gratitude to Zama for providing the open-source FHE primitives that make TrafficRep_FHE possible. Their innovative technology plays a crucial role in enhancing privacy and security in digital reporting systems.

