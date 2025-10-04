import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import { Container, Navbar, Nav, Button, Modal, Form } from "react-bootstrap";
import {
  SuiClientProvider,
  WalletProvider,
  useCurrentAccount,
  useCurrentWallet,
  useConnectWallet,
  useWallets,
  useDisconnectWallet,
} from "@mysten/dapp-kit"; // Updated to use the new dapp-kit
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClient } from "@mysten/sui/client";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import logo from "./img/su-logo.png";
import Dashboard from "./Dashboard";
import Chat from "./Chat";
import Settings from "./Settings";

function AppContent() {
  const [userName, setUserName] = useState("");
  const [menuColor, setMenuColor] = useState("#ff00ff"); // Default to pink from Chat.js
  const [showWalletModal, setShowWalletModal] = useState(false);
  const connect = useConnectWallet({
    onSuccess: () => {
      console.log('Wallet connected successfully');
    },
    onError: (error) => {
      console.error('Wallet connection failed:', error);
    }
  });
  const disconnect = useDisconnectWallet();
  const wallets = useWallets();
  const currentAccount = useCurrentAccount();
  const currentWallet = useCurrentWallet();
  const isConnected = !!currentAccount;
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const client = new SuiClient({
      url: "https://fullnode.testnet.sui.io", // Testnet for local CORS
    });
    const fetchUserName = async () => {
      if (isConnected && currentAccount) {
        const objects = await client.getOwnedObjects({
          owner: currentAccount.address,
          options: { showType: true, showContent: true },
        });
        const userObject = objects.data.find((obj) =>
          obj.data.type.includes(
            "0x3f455d572c2b923918a0623bef2e075b9870dc650c2f9e164aa2ea5693506d80::su_messaging::User"
          )
        );
        setUserName(
          userObject?.data.content.fields.display_name
            ? new TextDecoder().decode(
                new Uint8Array(userObject.data.content.fields.display_name)
              )
            : currentAccount.address.slice(0, 6) + "..."
        );
      }
    };
    fetchUserName();

    // Dynamic color animation
    let r = 255;
    let g = 0;
    let b = 255;
    const interval = setInterval(() => {
      r = (r + 1) % 256;
      g = (g + 2) % 256;
      b = (b + 3) % 256;
      setMenuColor(`rgb(${r}, ${g}, ${b})`);
    }, 100);
    return () => clearInterval(interval);
  }, [isConnected, currentAccount]);

  // Close wallet dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showWalletDropdown && !event.target.closest('.wallet-dropdown-container')) {
        setShowWalletDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWalletDropdown]);

  const handleDashboardClick = (e) => {
    if (!isConnected) {
      e.preventDefault();
      setShowWalletModal(true);
    }
  };

  const handleWebConnect = async () => {
    if (window.innerWidth < 768 && selectedWallet) {
      if (selectedWallet === "sui") {
        try {
          await connect(); // Initiate connection, targeting Slush app
          if (isConnected && currentAccount) {
            setShowWalletModal(false); // Close modal on success
            window.location.href = "https://su-messaging.netlify.app"; // Redirect back to site
          }
        } catch (error) {
          console.error("Connection failed:", error);
          // Fallback to App Store only if app not installed
          if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            window.location.href =
              "https://apps.apple.com/us/app/slush-a-sui-wallet/id6476572140";
          }
        }
      }
    }
  };

  // Simple mobile detection based on window width (e.g., < 768px for mobile)
  const isMobile = window.innerWidth < 768;

  return (
    <div>
      <Navbar
        bg="dark"
        variant="dark"
        expand="lg"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          border: `4px solid ${menuColor}`,
          borderRadius: "12px",
          boxShadow: "0 0 20px rgba(0, 255, 255, 0.7)",
          fontFamily: "Orbitron, sans-serif",
          color: "#00ffff",
          background: "linear-gradient(135deg, #1a0033, #440088)",
          padding: "8px 15px",
        }}
      >
          <Container>
            <Navbar.Brand className="d-flex align-items-center gap-2">
              <Link to="/">
                <img
                  src={logo}
                  alt="SU Logo"
                  style={{
                    width: "40px",
                    height: "40px",
                    border: `2px solid ${menuColor}`,
                    borderRadius: "8px",
                  }}
                />
              </Link>
              <Link to="/" className="text-white text-decoration-none">
                <span
                  style={{ textShadow: "0 0 12px #00ffff", fontSize: "1.1em" }}
                >
                  {userName || "SU"}
                </span>
              </Link>
            </Navbar.Brand>
            <Nav className="ms-auto d-flex align-items-center">
              <Nav.Link
                as={Link}
                to="/settings"
                className="text-white me-2"
                style={{
                  textShadow: "0 0 6px #00ffff",
                  transition: "color 0.4s",
                  color: menuColor,
                  fontSize: "1em",
                }}
                onMouseEnter={(e) => (e.target.style.color = "#00ffff")}
                onMouseLeave={(e) => (e.target.style.color = menuColor)}
              >
                Settings
              </Nav.Link>
              {isMobile ? (
                <Button
                  onClick={() => setShowWalletModal(true)}
                  style={{
                    backgroundColor: menuColor,
                    borderColor: menuColor,
                    textShadow: "0 0 6px #00ffff",
                    fontSize: "1em",
                    padding: "6px 15px",
                    borderRadius: "8px",
                    transition: "background-color 0.4s",
                  }}
                  onMouseEnter={(e) =>
                    (e.target.style.backgroundColor = "#00ffff")
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.backgroundColor = menuColor)
                  }
                >
                  Connect Wallet
                </Button>
              ) : isConnected ? (
                // Connected wallet display - modern card style
                <div
                  className="wallet-dropdown-container"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: `linear-gradient(135deg, ${menuColor}20, ${menuColor}40)`,
                    border: `2px solid ${menuColor}`,
                    borderRadius: '12px',
                    padding: '8px 16px',
                    boxShadow: `0 0 20px ${menuColor}40`,
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 30px ${menuColor}60`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 20px ${menuColor}40`;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#00ff00',
                    boxShadow: '0 0 8px #00ff00',
                    animation: 'pulse 2s infinite',
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{
                      color: '#00ffff',
                      fontSize: '0.9em',
                      fontWeight: 'bold',
                      textShadow: '0 0 6px #00ffff',
                    }}>
                      {currentWallet?.name || 'Connected'}
                    </span>
                    <span style={{
                      color: '#00ffff',
                      fontSize: '0.7em',
                      opacity: 0.8,
                      fontFamily: 'monospace',
                    }}>
                      {currentAccount?.address?.slice(0, 8)}...{currentAccount?.address?.slice(-6)}
                    </span>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      disconnect.mutate();
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      border: `1px solid ${menuColor}`,
                      color: menuColor,
                      fontSize: '0.7em',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = menuColor;
                      e.target.style.color = '#1a0033';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = menuColor;
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                // Modern wallet selector
                <div className="wallet-dropdown-container" style={{ position: 'relative' }}>
                  <Button
                    onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                    style={{
                      backgroundColor: menuColor,
                      border: `2px solid ${menuColor}`,
                      color: '#00ffff',
                      textShadow: '0 0 8px #00ffff',
                      fontSize: '0.9em',
                      padding: '10px 20px',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      boxShadow: `0 0 20px ${menuColor}40`,
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.boxShadow = `0 0 30px ${menuColor}60`;
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.boxShadow = `0 0 20px ${menuColor}40`;
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    <span>🔗</span>
                    Connect Wallet
                    <span style={{
                      transition: 'transform 0.3s ease',
                      transform: showWalletDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}>▼</span>
                  </Button>

                  {showWalletDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        background: 'linear-gradient(135deg, #1a0033, #330066)',
                        border: `2px solid ${menuColor}`,
                        borderRadius: '12px',
                        boxShadow: `0 0 30px ${menuColor}40`,
                        minWidth: '200px',
                        zIndex: 1000,
                        animation: 'fadeIn 0.2s ease-out',
                      }}
                    >
                      {wallets.map((wallet, index) => (
                        <div
                          key={wallet.name}
                          onClick={() => {
                            console.log('Connecting to wallet:', wallet);
                            connect.mutate({ wallet });
                            setShowWalletDropdown(false);
                          }}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom: index < wallets.length - 1 ? `1px solid ${menuColor}40` : 'none',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = `${menuColor}20`;
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: menuColor,
                            boxShadow: `0 0 6px ${menuColor}`,
                          }} />
                          <span style={{
                            color: '#00ffff',
                            textShadow: '0 0 4px #00ffff',
                            fontWeight: '500',
                          }}>
                            {wallet.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Nav>
          </Container>
        </Navbar>
        <Routes>
          <Route
            path="/"
            element={
              <Container
                className="mt-4 text-center"
                style={{
                  background: "linear-gradient(135deg, #1a0033, #440088)",
                  border: `4px solid ${menuColor}`,
                  borderRadius: "12px",
                  boxShadow: "0 0 20px #00ffff",
                  color: "#00ffff",
                  fontFamily: "Orbitron, sans-serif",
                  padding: "20px",
                }}
              >
                <h1
                  className="d-flex align-items-center justify-content-center gap-2"
                  style={{
                    textShadow: "0 0 15px #00ffff",
                    fontSize: "2em",
                  }}
                >
                  Welcome to {userName || "SU"}
                  <img
                    src={logo}
                    alt="SU Logo"
                    style={{
                      width: "50px",
                      height: "50px",
                      border: `2px solid ${menuColor}`,
                      borderRadius: "8px",
                    }}
                  />
                </h1>
                <p
                  style={{
                    textShadow: "0 0 6px #ff00ff",
                    fontSize: "1.1em",
                  }}
                >
                  A decentralized messaging app powered by the SUI blockchain.
                </p>
                <div className="mt-4">
                  <Button
                    as={Link}
                    to="/dashboard"
                    variant="outline-primary"
                    className="mx-2"
                    style={{
                      borderColor: menuColor,
                      color: menuColor,
                      textShadow: "0 0 6px #00ffff",
                      padding: "10px 20px",
                      fontSize: "1.1em",
                      borderRadius: "8px",
                      transition: "background-color 0.4s",
                    }}
                    onClick={handleDashboardClick}
                    onMouseEnter={(e) =>
                      (e.target.style.backgroundColor = "#00ffff")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.backgroundColor = "transparent")
                    }
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </Container>
            }
          />
          <Route
            path="/dashboard"
            element={isConnected ? <Dashboard /> : <Navigate to="/" replace />}
          />
          <Route path="/chat/:id" element={<Chat />} />
          <Route
            path="/settings"
            element={<Settings setMenuColor={setMenuColor} />}
          />
        </Routes>

        <Modal
          show={showWalletModal}
          onHide={() => setShowWalletModal(false)}
          centered
          style={{
            maxWidth: "90%",
            [`@media (maxWidth: 767px)`]: {
              width: "90%",
            },
          }}
        >
          <Modal.Header
            style={{
              background: "linear-gradient(135deg, #1a0033, #440088)",
              borderBottom: `2px solid ${menuColor}`,
              color: "#00ffff",
              fontFamily: "Orbitron, sans-serif",
            }}
          >
            <Modal.Title style={{ textShadow: "0 0 12px #00ffff" }}>
              Wallet Required
            </Modal.Title>
          </Modal.Header>
          <Modal.Body
            style={{
              background: "#1a0033",
              color: "#00ffff",
              textShadow: "0 0 4px #ff00ff",
              fontSize: "1em",
            }}
          >
            {window.innerWidth < 768 ? (
              <div>
                <p>Please select your wallet to connect:</p>
                <Form.Select
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  style={{
                    backgroundColor: "#1a0033",
                    color: "#00ffff",
                    border: `1px dashed ${menuColor}`,
                    borderRadius: "5px",
                    padding: "5px",
                    marginBottom: "10px",
                  }}
                >
                  <option value="">Select Wallet</option>
                  <option value="sui">SUI Wallet (Slush)</option>
                </Form.Select>
                <p>
                  This will open the Slush Wallet app for connection. After
                  signing the request, you’ll be redirected back to{" "}
                  <a
                    href="https://su-messaging.netlify.app"
                    style={{ color: "#00ffff", textDecoration: "underline" }}
                  >
                    https://su-messaging.netlify.app
                  </a>{" "}
                  signed in.
                </p>
              </div>
            ) : (
              "Please connect your wallet to access the Dashboard and enjoy the full SU experience!"
            )}
          </Modal.Body>
          <Modal.Footer
            style={{
              background: "linear-gradient(135deg, #1a0033, #440088)",
              borderTop: `2px solid ${menuColor}`,
            }}
          >
            <Button
              variant="primary"
              onClick={() => setShowWalletModal(false)}
              style={{
                backgroundColor: menuColor,
                borderColor: menuColor,
                textShadow: "0 0 6px #00ffff",
                padding: "6px 15px",
                fontSize: "1em",
                borderRadius: "8px",
                transition: "background-color 0.4s",
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
            >
              Close
            </Button>
            {window.innerWidth < 768 && selectedWallet && (
              <Button
                variant="primary"
                onClick={handleWebConnect}
                style={{
                  backgroundColor: menuColor,
                  borderColor: menuColor,
                  textShadow: "0 0 6px #00ffff",
                  padding: "6px 15px",
                  fontSize: "1em",
                  borderRadius: "8px",
                  transition: "background-color 0.4s",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = "#00ffff")
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor = menuColor)
                }
              >
                Connect
              </Button>
            )}
          </Modal.Footer>
        </Modal>
      </div>
  );
}

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={{ mainnet: { url: "https://fullnode.mainnet.sui.io:443" } }} defaultNetwork="mainnet">
        <WalletProvider
          autoConnect={true}
        >
          <Router>
            <AppContent />
          </Router>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App;
