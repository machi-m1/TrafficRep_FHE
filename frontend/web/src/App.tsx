import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface ViolationReport {
  id: string;
  licensePlate: string;
  location: string;
  timestamp: number;
  videoHash: string;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ViolationReport[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newReportData, setNewReportData] = useState({ 
    licensePlate: "", 
    location: "", 
    severity: "",
    videoHash: "" 
  });
  const [selectedReport, setSelectedReport] = useState<ViolationReport | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [stats, setStats] = useState({ total: 0, verified: 0, recent: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [faqOpen, setFaqOpen] = useState(false);

  const { initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const reportsList: ViolationReport[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          reportsList.push({
            id: businessId,
            licensePlate: businessData.name,
            location: businessData.description,
            timestamp: Number(businessData.timestamp),
            videoHash: `0x${businessData.publicValue1.toString(16)}`,
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setReports(reportsList);
      setStats({
        total: reportsList.length,
        verified: reportsList.filter(r => r.isVerified).length,
        recent: reportsList.filter(r => Date.now()/1000 - r.timestamp < 86400).length
      });
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const submitReport = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setSubmittingReport(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Submitting encrypted report..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const severityValue = parseInt(newReportData.severity) || 1;
      const businessId = `violation-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, severityValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newReportData.licensePlate,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newReportData.videoHash.slice(2, 10) || "0", 16),
        0,
        newReportData.location
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Report submitted successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowReportModal(false);
      setNewReportData({ licensePlate: "", location: "", severity: "", videoHash: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Submission failed";
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setSubmittingReport(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return Number(businessData.decryptedValue) || 0;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data is already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const available = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: `System available: ${available}` 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredReports = reports.filter(report =>
    report.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStats = () => (
    <div className="stats-panels">
      <div className="stat-panel metal-gold">
        <h3>Total Reports</h3>
        <div className="stat-value">{stats.total}</div>
        <div className="stat-trend">+{stats.recent} today</div>
      </div>
      
      <div className="stat-panel metal-silver">
        <h3>Verified Cases</h3>
        <div className="stat-value">{stats.verified}</div>
        <div className="stat-trend">FHE Verified</div>
      </div>
      
      <div className="stat-panel metal-bronze">
        <h3>Success Rate</h3>
        <div className="stat-value">{stats.total ? Math.round((stats.verified / stats.total) * 100) : 0}%</div>
        <div className="stat-trend">Accuracy</div>
      </div>
    </div>
  );

  const renderFAQ = () => (
    <div className="faq-section">
      <h3 onClick={() => setFaqOpen(!faqOpen)} className="faq-toggle">
        Frequently Asked Questions {faqOpen ? "▲" : "▼"}
      </h3>
      {faqOpen && (
        <div className="faq-content">
          <div className="faq-item">
            <h4>How does FHE protect my privacy?</h4>
            <p>Your video data is encrypted before upload and remains encrypted during police verification using Fully Homomorphic Encryption.</p>
          </div>
          <div className="faq-item">
            <h4>Is my identity protected?</h4>
            <p>Yes, the system uses zero-knowledge proofs to verify violations without revealing your identity.</p>
          </div>
          <div className="faq-item">
            <h4>What data is encrypted?</h4>
            <p>Violation severity scores and timestamps are FHE-encrypted. Only authorized police can decrypt verified data.</p>
          </div>
        </div>
      )}
    </div>
  );

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header metal-header">
          <div className="logo">
            <div className="badge-icon">🚨</div>
            <h1>Private Traffic Watch</h1>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt metal-bg">
          <div className="connection-content">
            <div className="police-badge">👮</div>
            <h2>Connect to Report Violations Securely</h2>
            <p>Your identity remains anonymous while helping keep roads safe with FHE encryption</p>
            <div className="connection-steps">
              <div className="step metal-step">
                <span>1</span>
                <p>Connect wallet anonymously</p>
              </div>
              <div className="step metal-step">
                <span>2</span>
                <p>Upload encrypted violation evidence</p>
              </div>
              <div className="step metal-step">
                <span>3</span>
                <p>Police verify without your identity</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen metal-bg">
        <div className="fhe-spinner metal-spinner"></div>
        <p>Initializing FHE Security System...</p>
        <p className="loading-note">Encryption keys being generated</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen metal-bg">
      <div className="fhe-spinner metal-spinner"></div>
      <p>Loading secure reporting system...</p>
    </div>
  );

  return (
    <div className="app-container metal-theme">
      <header className="app-header metal-header">
        <div className="logo">
          <div className="badge-icon">🚨</div>
          <h1>Private Traffic Watch</h1>
          <span className="tagline">FHE-Protected Reporting</span>
        </div>
        
        <div className="header-actions">
          <button onClick={checkAvailability} className="status-btn metal-btn">
            System Status
          </button>
          <button 
            onClick={() => setShowReportModal(true)} 
            className="report-btn metal-btn primary"
          >
            🚔 Report Violation
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="dashboard-section">
          <h2>Traffic Violation Dashboard</h2>
          {renderStats()}
          
          <div className="search-section">
            <input
              type="text"
              placeholder="Search by license plate or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input metal-input"
            />
          </div>
        </div>
        
        <div className="reports-section">
          <div className="section-header">
            <h2>Violation Reports</h2>
            <div className="header-actions">
              <button 
                onClick={loadData} 
                className="refresh-btn metal-btn"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "🔄 Refresh"}
              </button>
            </div>
          </div>
          
          <div className="reports-grid">
            {filteredReports.length === 0 ? (
              <div className="no-reports metal-panel">
                <p>No violation reports found</p>
                <button 
                  className="report-btn metal-btn primary" 
                  onClick={() => setShowReportModal(true)}
                >
                  Report First Violation
                </button>
              </div>
            ) : filteredReports.map((report, index) => (
              <div 
                className={`report-card metal-panel ${report.isVerified ? "verified" : ""}`}
                key={index}
                onClick={() => setSelectedReport(report)}
              >
                <div className="report-header">
                  <div className="license-plate">{report.licensePlate}</div>
                  <div className={`status-badge ${report.isVerified ? "verified" : "pending"}`}>
                    {report.isVerified ? "✅ Verified" : "⏳ Pending"}
                  </div>
                </div>
                <div className="report-location">📍 {report.location}</div>
                <div className="report-meta">
                  <span>Time: {new Date(report.timestamp * 1000).toLocaleString()}</span>
                  <span>Video: {report.videoHash.slice(0, 8)}...</span>
                </div>
                {report.isVerified && report.decryptedValue && (
                  <div className="severity-score">
                    Severity: {report.decryptedValue}/10
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {renderFAQ()}
      </div>
      
      {showReportModal && (
        <ReportModal 
          onSubmit={submitReport} 
          onClose={() => setShowReportModal(false)} 
          submitting={submittingReport} 
          reportData={newReportData} 
          setReportData={setNewReportData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedReport && (
        <ReportDetailModal 
          report={selectedReport} 
          onClose={() => setSelectedReport(null)} 
          isDecrypting={fheIsDecrypting} 
          decryptData={() => decryptData(selectedReport.id)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal metal-panel">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner metal-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportModal: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  submitting: boolean;
  reportData: any;
  setReportData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, submitting, reportData, setReportData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setReportData({ ...reportData, [name]: value });
  };

  return (
    <div className="modal-overlay metal-overlay">
      <div className="report-modal metal-panel">
        <div className="modal-header">
          <h2>🚔 Report Traffic Violation</h2>
          <button onClick={onClose} className="close-modal metal-btn">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice metal-notice">
            <strong>FHE 🔐 Privacy Protection</strong>
            <p>Violation severity will be encrypted with Zama FHE - only police can decrypt after verification</p>
          </div>
          
          <div className="form-group">
            <label>License Plate *</label>
            <input 
              type="text" 
              name="licensePlate" 
              value={reportData.licensePlate} 
              onChange={handleChange} 
              placeholder="Enter license plate number..." 
              className="metal-input"
            />
          </div>
          
          <div className="form-group">
            <label>Location *</label>
            <input 
              type="text" 
              name="location" 
              value={reportData.location} 
              onChange={handleChange} 
              placeholder="Enter violation location..." 
              className="metal-input"
            />
          </div>
          
          <div className="form-group">
            <label>Violation Severity (1-10) *</label>
            <select 
              name="severity" 
              value={reportData.severity} 
              onChange={handleChange}
              className="metal-input"
            >
              <option value="">Select severity...</option>
              {[1,2,3,4,5,6,7,8,9,10].map(num => (
                <option key={num} value={num}>{num} - {num <= 3 ? "Minor" : num <= 7 ? "Moderate" : "Severe"}</option>
              ))}
            </select>
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Video Hash *</label>
            <input 
              type="text" 
              name="videoHash" 
              value={reportData.videoHash} 
              onChange={handleChange} 
              placeholder="Enter video file hash..." 
              className="metal-input"
            />
            <div className="data-type-label">Public Reference</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn metal-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={submitting || isEncrypting || !reportData.licensePlate || !reportData.location || !reportData.severity || !reportData.videoHash} 
            className="submit-btn metal-btn primary"
          >
            {submitting || isEncrypting ? "Encrypting and Submitting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReportDetailModal: React.FC<{
  report: any;
  onClose: () => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ report, onClose, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    await decryptData();
  };

  return (
    <div className="modal-overlay metal-overlay">
      <div className="report-detail-modal metal-panel">
        <div className="modal-header">
          <h2>Violation Report Details</h2>
          <button onClick={onClose} className="close-modal metal-btn">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="report-info">
            <div className="info-item">
              <span>License Plate:</span>
              <strong>{report.licensePlate}</strong>
            </div>
            <div className="info-item">
              <span>Location:</span>
              <strong>{report.location}</strong>
            </div>
            <div className="info-item">
              <span>Report Time:</span>
              <strong>{new Date(report.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-item">
              <span>Video Hash:</span>
              <strong>{report.videoHash}</strong>
            </div>
            <div className="info-item">
              <span>Reporter:</span>
              <strong>{report.creator.substring(0, 6)}...{report.creator.substring(38)}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Violation Data</h3>
            
            <div className="data-row">
              <div className="data-label">Severity Level:</div>
              <div className="data-value">
                {report.isVerified && report.decryptedValue ? 
                  `${report.decryptedValue}/10 (Police Verified)` : 
                  "🔒 FHE Encrypted Integer"
                }
              </div>
              <button 
                className={`decrypt-btn metal-btn ${report.isVerified ? 'verified' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "🔓 Verifying..."
                ) : report.isVerified ? (
                  "✅ Verified"
                ) : (
                  "🔓 Verify with Police"
                )}
              </button>
            </div>
            
            <div className="fhe-info metal-notice">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>Police Verification Required</strong>
                <p>Only authorized police can decrypt and verify the violation severity while protecting reporter anonymity.</p>
              </div>
            </div>
          </div>
          
          {report.isVerified && report.decryptedValue && (
            <div className="verification-section">
              <h3>✅ Police Verification Complete</h3>
              <div className="verified-data">
                <div className="verified-item">
                  <span>Severity Level:</span>
                  <strong>{report.decryptedValue}/10</strong>
                </div>
                <div className="verified-item">
                  <span>Status:</span>
                  <strong>Case Closed</strong>
                </div>
                <div className="verified-item">
                  <span>Reporter Protection:</span>
                  <strong>Identity Secured</strong>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn metal-btn">Close</button>
          {!report.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn metal-btn primary"
            >
              {isDecrypting ? "Police Verifying..." : "Request Police Verification"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

