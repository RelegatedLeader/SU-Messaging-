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
  useSignPersonalMessage,
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
import {
  isMobileDevice,
  parseMobileError,
  MOBILE_WALLETS
} from "./utils/mobileWallet";
import MobileErrorModal from "./components/MobileErrorModal";

// Auth callback component for handling return from Slush wallet
function AuthCallback() {
  const navigate = useNavigate();
  const connect = useConnectWallet();
  const [menuColor] = useState("#ff00ff");

  React.useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Handling auth callback from Slush wallet');
        
        // Attempt to connect the wallet
        await connect.mutateAsync();
        
        // If successful, redirect to dashboard
        navigate('/dashboard');
      } catch (error) {
        console.error('Auth callback failed:', error);
        // If connection fails, redirect back to home
        navigate('/');
      }
    };

    handleAuthCallback();
  }, [connect, navigate]);

  return (
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
      <h2 style={{ textShadow: "0 0 15px #00ffff" }}>
        Connecting to Wallet...
      </h2>
      <p style={{ textShadow: "0 0 6px #ff00ff" }}>
        Please wait while we establish your wallet connection.
      </p>
      <div style={{ margin: "20px 0" }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: `3px solid ${menuColor}`,
          borderTop: "3px solid transparent",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto",
        }} />
      </div>
    </Container>
  );
}

function AppContent() {
  const [userName, setUserName] = useState("");
  const [menuColor, setMenuColor] = useState("#ff00ff"); // Default to pink from Chat.js
  const [showWalletModal, setShowWalletModal] = useState(false);
  const connect = useConnectWallet({
    onSuccess: () => {
      console.log('Wallet connected successfully');

      // After successful connection, sign authentication message
      if (currentAccount) {
        const message = `Sign in to SU Messaging\n\nAddress: ${currentAccount.address}\nTimestamp: ${new Date().toISOString()}`;

        signPersonalMessage({
          message: new TextEncoder().encode(message),
        }, {
          onSuccess: (result) => {
            console.log('Authentication signature successful:', result);
            navigate('/dashboard');
          },
          onError: (error) => {
            console.error('Authentication signature failed:', error);
            const errorType = parseMobileError(error);
            setMobileError(error);
            setMobileErrorType(errorType);
            setShowMobileError(true);
          }
        });
      } else {
        // If no account yet, wait a bit and try again (for mobile redirect timing)
        setTimeout(() => {
          if (currentAccount) {
            const message = `Sign in to SU Messaging\n\nAddress: ${currentAccount.address}\nTimestamp: ${new Date().toISOString()}`;

            signPersonalMessage({
              message: new TextEncoder().encode(message),
            }, {
              onSuccess: (result) => {
                console.log('Authentication signature successful:', result);
                navigate('/dashboard');
              },
              onError: (error) => {
                console.error('Authentication signature failed:', error);
                const errorType = parseMobileError(error);
                setMobileError(error);
                setMobileErrorType(errorType);
                setShowMobileError(true);
              }
            });
          }
        }, 1000);
      }
    },
    onError: (error) => {
      console.error('Wallet connection failed:', error);
      const errorType = parseMobileError(error);
      setMobileError(error);
      setMobileErrorType(errorType);
      setShowMobileError(true);
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

  // Handle deep link to Slush wallet app for mobile authentication
  const handleSlushDeepLink = () => {
    if (isMobileDevice()) {
      try {
        // Get the current URL for redirect back
        const currentUrl = window.location.origin;
        const redirectUrl = encodeURIComponent(`${currentUrl}/auth-callback`);
        
        // Create deep link to Slush app
        const deepLink = `slush://signin?redirect_uri=${redirectUrl}`;
        
        console.log('Opening Slush deep link:', deepLink);
        
        // Open the deep link
        window.location.href = deepLink;
        
        // Fallback: if deep link doesn't work, try opening in new window
        setTimeout(() => {
          window.open(deepLink, '_blank');
        }, 1000);
        
      } catch (error) {
        console.error('Failed to open Slush deep link:', error);
        // Fallback to regular connection
        handleWebConnect();
      }
    } else {
      // Desktop fallback
      handleWebConnect();
    }
  };

  // Sign personal message for authentication
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  // Mobile error modal state
  const [showMobileError, setShowMobileError] = useState(false);
  const [mobileError, setMobileError] = useState(null);
  const [mobileErrorType, setMobileErrorType] = useState(null);

  useEffect(() => {
    const client = new SuiClient({
      url: "https://fullnode.mainnet.sui.io:443",
    });
    const fetchUserName = async () => {
      if (isConnected && currentAccount) {
        const objects = await client.getOwnedObjects({
          owner: currentAccount.address,
          options: { showType: true, showContent: true },
        });
        const userObject = objects.data.find((obj) =>
          obj.data.type.includes(
            "0x2aaad5d1ce7482b5850dd11642358bf23cb0e6432b12a581eb77d212dca54045::su_messaging::User"
          )
        );
        setUserName(
          userObject?.data.content.fields.display_name
            ? new TextDecoder().decode(
                new Uint8Array(userObject.data.content.fields.display_name)
              )
            : localStorage.getItem("currentDisplayName") || currentAccount.address.slice(0, 6) + "..."
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
  }, [isConnected, currentAccount, location.pathname]);

  // Navigate to dashboard when wallet connects (including auto-connect)
  useEffect(() => {
    if (isConnected && currentAccount && location.pathname === '/') {
      navigate('/dashboard');
    }
  }, [isConnected, currentAccount, navigate, location.pathname]);

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
    try {
      // Connect to wallet - dapp-kit will handle Slush wallet detection and mobile redirects
      await connect();
    } catch (error) {
      console.error("Wallet connection failed:", error);
      const errorType = parseMobileError(error);
      setMobileError(error);
      setMobileErrorType(errorType);
      setShowMobileError(true);
    }
  };

  // Enhanced mobile detection
  const isMobile = isMobileDevice();

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
                  onClick={handleSlushDeepLink}
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
          <Route
            path="/auth-callback"
            element={<AuthCallback />}
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
            {isMobile ? (
              <div>
                <p style={{ fontSize: "1.1em", marginBottom: "15px" }}>
                  📱 <strong>Mobile Connection</strong>
                </p>
                <p style={{ marginBottom: "15px" }}>
                  Connect your Slush Wallet to sign in and start using SU Messaging.
                  You'll be redirected to your wallet app to approve the connection securely.
                </p>
                <div style={{
                  background: "rgba(0, 255, 255, 0.1)",
                  border: "1px solid #00ffff",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "15px"
                }}>
                  <strong>🔐 Sign In Process:</strong>
                  <br />
                  <small style={{ color: "#ffffff" }}>
                    1. Click "Sign In with Slush Wallet"<br />
                    2. Get redirected to Slush wallet app<br />
                    3. Review and sign the authentication message<br />
                    4. Return to SU Messaging automatically
                  </small>
                </div>
                <Form.Select
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  style={{
                    backgroundColor: "#1a0033",
                    color: "#00ffff",
                    border: `1px dashed ${menuColor}`,
                    borderRadius: "5px",
                    padding: "8px",
                    marginBottom: "10px",
                    fontSize: "0.9em",
                  }}
                >
                  <option value="">Select Wallet</option>
                  <option value={MOBILE_WALLETS.SUI_WALLET}>Sui Wallet</option>
                </Form.Select>
                <p style={{ fontSize: "0.9em", color: "#ffffff" }}>
                  <strong>🔐 Sign In Required:</strong> You'll be redirected to Sui Wallet (Slush) to sign an authentication message.
                  This proves ownership of your address and logs you into SU Messaging.
                </p>
              </div>
            ) : (
              <div>
                <p>🖥️ <strong>Desktop Connection</strong></p>
                <p>
                  Please connect your wallet to access the Dashboard and enjoy the full SU experience!
                  We recommend using a browser wallet extension for the best experience.
                </p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer
            style={{
              background: "linear-gradient(135deg, #1a0033, #440088)",
              borderTop: `2px solid ${menuColor}`,
            }}
          >
            <Button
              variant="secondary"
              onClick={() => setShowWalletModal(false)}
              style={{
                backgroundColor: "transparent",
                borderColor: menuColor,
                color: menuColor,
                textShadow: "0 0 4px #00ffff",
                padding: "6px 15px",
                fontSize: "1em",
                borderRadius: "8px",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = `${menuColor}20`;
                e.target.style.color = "#00ffff";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "transparent";
                e.target.style.color = menuColor;
              }}
            >
              Close
            </Button>
            {isMobile && (
              <Button
                variant="primary"
                onClick={handleWebConnect}
                style={{
                  backgroundColor: menuColor,
                  borderColor: menuColor,
                  textShadow: "0 0 6px #00ffff",
                  padding: "8px 20px",
                  fontSize: "1em",
                  borderRadius: "8px",
                  transition: "background-color 0.3s",
                  fontWeight: "bold",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = "#00ffff")
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor = menuColor)
                }
              >
                � Sign In with Wallet
              </Button>
            )}
          </Modal.Footer>
        </Modal>

        {/* Mobile Error Modal */}
        <MobileErrorModal
          show={showMobileError}
          onHide={() => setShowMobileError(false)}
          error={mobileError}
          errorType={mobileErrorType}
          onRetry={handleWebConnect}
          menuColor={menuColor}
        />
      </div>
  );
}

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider 
        networks={{
          mainnet: { url: "https://fullnode.mainnet.sui.io:443" },
          testnet: { url: "https://fullnode.testnet.sui.io:443" }
        }} 
        defaultNetwork="mainnet"
      >
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
