pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract TrafficRep_FHE is ZamaEthereumConfig {
    
    struct Report {
        euint32 encryptedVideoHash;
        uint256 publicTimestamp;
        uint256 publicLocation;
        address reporter;
        uint256 reportTime;
        uint32 decryptedVideoHash;
        bool isVerified;
    }
    
    mapping(string => Report) public reports;
    string[] public reportIds;
    
    event ReportSubmitted(string indexed reportId, address indexed reporter);
    event ReportVerified(string indexed reportId, uint32 decryptedVideoHash);
    
    constructor() ZamaEthereumConfig() {
    }
    
    function submitReport(
        string calldata reportId,
        externalEuint32 encryptedVideoHash,
        bytes calldata inputProof,
        uint256 publicTimestamp,
        uint256 publicLocation
    ) external {
        require(bytes(reports[reportId].reporter).length == 0, "Report already exists");
        require(FHE.isInitialized(FHE.fromExternal(encryptedVideoHash, inputProof)), "Invalid encrypted input");
        
        reports[reportId] = Report({
            encryptedVideoHash: FHE.fromExternal(encryptedVideoHash, inputProof),
            publicTimestamp: publicTimestamp,
            publicLocation: publicLocation,
            reporter: msg.sender,
            reportTime: block.timestamp,
            decryptedVideoHash: 0,
            isVerified: false
        });
        
        FHE.allowThis(reports[reportId].encryptedVideoHash);
        FHE.makePubliclyDecryptable(reports[reportId].encryptedVideoHash);
        
        reportIds.push(reportId);
        emit ReportSubmitted(reportId, msg.sender);
    }
    
    function verifyReport(
        string calldata reportId,
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(bytes(reports[reportId].reporter).length > 0, "Report does not exist");
        require(!reports[reportId].isVerified, "Report already verified");
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(reports[reportId].encryptedVideoHash);
        
        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
        
        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));
        
        reports[reportId].decryptedVideoHash = decodedValue;
        reports[reportId].isVerified = true;
        
        emit ReportVerified(reportId, decodedValue);
    }
    
    function getEncryptedVideoHash(string calldata reportId) external view returns (euint32) {
        require(bytes(reports[reportId].reporter).length > 0, "Report does not exist");
        return reports[reportId].encryptedVideoHash;
    }
    
    function getReport(string calldata reportId) external view returns (
        uint256 publicTimestamp,
        uint256 publicLocation,
        address reporter,
        uint256 reportTime,
        bool isVerified,
        uint32 decryptedVideoHash
    ) {
        require(bytes(reports[reportId].reporter).length > 0, "Report does not exist");
        Report storage report = reports[reportId];
        
        return (
            report.publicTimestamp,
            report.publicLocation,
            report.reporter,
            report.reportTime,
            report.isVerified,
            report.decryptedVideoHash
        );
    }
    
    function getAllReportIds() external view returns (string[] memory) {
        return reportIds;
    }
    
    function isAvailable() public pure returns (bool) {
        return true;
    }
}

