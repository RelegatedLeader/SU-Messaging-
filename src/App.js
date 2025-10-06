import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import { Container, Navbar, Nav, Button, Modal } from "react-bootstrap";
import {
  SuiClientProvider,
  WalletProvider,
  useCurrentAccount,
  useCurrentWallet,
  useConnectWallet,
  useWallets,
  useDisconnectWallet,
  useSignPersonalMessage,
  ConnectButton,
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
} from "./utils/mobileWallet";
import MobileErrorModal from "./components/MobileErrorModal";

// Auth callback component for handling return from Slush wallet
function AuthCallback() {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const connect = useConnectWallet();
  const [menuColor] = useState("#ff00ff");
  const [retryCount, setRetryCount] = React.useState(0);
  const [showManualConnect, setShowManualConnect] = React.useState(false);

  React.useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Handling auth callback from Slush wallet');

        // Check if this is a deep link callback
        const authPending = sessionStorage.getItem('authPending');
        const authTimestamp = sessionStorage.getItem('authTimestamp');

        if (authPending && authTimestamp) {
          // Clear the session storage
          sessionStorage.removeItem('authPending');
          sessionStorage.removeItem('authTimestamp');

          // Check if user is connected
          if (currentAccount) {
            console.log('Wallet connected, proceeding with signature');

            // Sign authentication message to prove ownership
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
                navigate('/');
              }
            });
          } else {
            console.log('Wallet not connected yet, waiting...');

            // If not connected after delay, show manual connect option
            setTimeout(() => {
              if (!currentAccount) {
                setShowManualConnect(true);
              }
            }, 3000);
          }
        } else {
          // Regular callback handling
          if (currentAccount) {
            navigate('/dashboard');
          } else {
            navigate('/');
          }
        }

      } catch (error) {
        console.error('Auth callback failed:', error);
        navigate('/');
      }
    };

    // Small delay to ensure wallet state is updated
    setTimeout(handleAuthCallback, 1500);
  }, [currentAccount, signPersonalMessage, navigate, retryCount]);

  const handleManualConnect = async () => {
    try {
      setRetryCount(prev => prev + 1);
      await connect.mutateAsync();
    } catch (error) {
      console.error('Manual connect failed:', error);
    }
  };

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
        Completing Authentication...
      </h2>
      <p style={{ textShadow: "0 0 6px #ff00ff" }}>
        Please wait while we verify your wallet connection and complete the sign-in process.
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

      {showManualConnect && (
        <div style={{ marginTop: "20px" }}>
          <p style={{ fontSize: "0.9em", opacity: 0.8, marginBottom: "15px" }}>
            If authentication didn't complete automatically, please connect manually:
          </p>
          <Button
            onClick={handleManualConnect}
            style={{
              backgroundColor: menuColor,
              borderColor: menuColor,
              textShadow: "0 0 6px #00ffff",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "0.9em",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
          >
            Connect Wallet Manually
          </Button>
        </div>
      )}

      <p style={{ fontSize: "0.9em", opacity: 0.8, marginTop: "15px" }}>
        Make sure your Slush wallet is unlocked and you've approved the connection.
      </p>
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
  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
                isConnected ? (
                  // Mobile Connected State
                  <div className="mobile-connect-container" style={{ width: '100%', padding: '0 16px' }}>
                    <div
                      style={{
                        background: `linear-gradient(135deg, ${menuColor}20, ${menuColor}40)`,
                        border: `2px solid ${menuColor}`,
                        borderRadius: '16px',
                        padding: '12px 16px',
                        boxShadow: `0 0 25px ${menuColor}60, inset 0 0 25px ${menuColor}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: '56px',
                        marginTop: '12px',
                        fontFamily: '"Orbitron", sans-serif',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                            fontSize: '14px',
                            fontWeight: 'bold',
                            textShadow: '0 0 6px #00ffff',
                          }}>
                            {currentWallet?.name || 'Connected'}
                          </span>
                          <span style={{
                            color: '#00ffff',
                            fontSize: '12px',
                            opacity: 0.8,
                            fontFamily: 'monospace',
                          }}>
                            {currentAccount?.address?.slice(0, 6)}...{currentAccount?.address?.slice(-4)}
                          </span>
                        </div>
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
                          fontSize: '12px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          transition: 'all 0.2s ease',
                          fontFamily: '"Orbitron", sans-serif',
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
                        ✕ LOGOUT
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Mobile Disconnected State - Styled ConnectButton wrapper
                  <div className="mobile-connect-container" style={{ width: '100%', padding: '0 16px' }}>
                    <div
                      className="cyberpunk-connect-wrapper"
                      style={{
                        position: 'relative',
                        marginTop: '12px',
                        fontFamily: '"Orbitron", sans-serif',
                        background: `linear-gradient(135deg, ${menuColor}, ${menuColor}dd)`,
                        border: `2px solid ${menuColor}`,
                        borderRadius: '16px',
                        boxShadow: `0 0 25px ${menuColor}60, inset 0 0 25px ${menuColor}20`,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: `linear-gradient(45deg, transparent 30%, ${menuColor}20 50%, transparent 70%)`,
                        animation: 'shimmer 3s infinite',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }} />
                      <ConnectButton
                        className="cyberpunk-connect-button"
                        style={{
                          width: '100%',
                          minHeight: '56px',
                          background: 'transparent',
                          border: 'none',
                          color: '#00ffff',
                          textShadow: '0 0 10px #00ffff, 0 0 20px #00ffff',
                          fontSize: '18px',
                          fontWeight: 'bold',
                          fontFamily: '"Orbitron", sans-serif',
                          position: 'relative',
                          zIndex: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          padding: '16px 24px',
                        }}
                      />
                    </div>
                  </div>
                )
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
                // Modern wallet selector - Modal trigger
                <Button
                  onClick={() => setShowWalletConnectModal(true)}
                  style={{
                    backgroundColor: menuColor,
                    border: `2px solid ${menuColor}`,
                    color: '#00ffff',
                    textShadow: '0 0 8px #00ffff',
                    fontSize: 'clamp(14px, 2vw, 16px)',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    boxShadow: `0 0 20px ${menuColor}40`,
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '48px',
                    fontFamily: '"Orbitron", sans-serif',
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
                </Button>
              )}
            </Nav>
          </Container>
        </Navbar>
        <Routes>
          <Route
            path="/"
            element={
              isConnected ? <Navigate to="/dashboard" replace /> : (
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
                        background: `linear-gradient(135deg, ${menuColor}20, ${menuColor}40)`,
                        border: `2px solid ${menuColor}`,
                        color: '#00ffff',
                        textShadow: '0 0 8px #00ffff',
                        padding: '12px 24px',
                        fontSize: '1.1em',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        boxShadow: `0 0 15px ${menuColor}40`,
                        transition: 'all 0.3s ease',
                        fontFamily: '"Orbitron", sans-serif',
                        minHeight: '48px',
                      }}
                      onClick={handleDashboardClick}
                      onMouseEnter={(e) => {
                        e.target.style.boxShadow = `0 0 25px ${menuColor}60`;
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.background = `linear-gradient(135deg, ${menuColor}30, ${menuColor}50)`;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.boxShadow = `0 0 15px ${menuColor}40`;
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.background = `linear-gradient(135deg, ${menuColor}20, ${menuColor}40)`;
                      }}
                    >
                      🚀 Go to Dashboard
                    </Button>
                  </div>
                </Container>
              )
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
              padding: "25px",
            }}
          >
            {isMobile ? (
              <div>
                <div style={{
                  textAlign: 'center',
                  marginBottom: '25px'
                }}>
                  <div style={{
                    fontSize: '3em',
                    marginBottom: '10px',
                    textShadow: '0 0 20px #00ffff',
                    animation: 'pulse 2s infinite'
                  }}>
                    �
                  </div>
                  <h4 style={{
                    color: '#00ffff',
                    textShadow: '0 0 12px #00ffff',
                    marginBottom: '15px',
                    fontFamily: 'Orbitron, sans-serif'
                  }}>
                    Connect with Slush Wallet
                  </h4>
                  <p style={{
                    color: '#ffffff',
                    marginBottom: '20px',
                    fontSize: '1em'
                  }}>
                    Sign in securely with your Slush Wallet to access SU Messaging
                  </p>
                </div>

                {/* Cyberpunk-styled Slush Wallet Button */}
                <div
                  onClick={handleWebConnect}
                  style={{
                    background: `linear-gradient(135deg, ${menuColor}20, ${menuColor}40)`,
                    border: `3px solid ${menuColor}`,
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontFamily: 'Orbitron, sans-serif',
                    boxShadow: `0 0 25px ${menuColor}40, inset 0 0 25px ${menuColor}10`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.boxShadow = `0 0 35px ${menuColor}60, inset 0 0 35px ${menuColor}20`;
                    e.target.style.transform = 'translateY(-3px)';
                    e.target.style.borderColor = '#00ffff';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.boxShadow = `0 0 25px ${menuColor}40, inset 0 0 25px ${menuColor}10`;
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.borderColor = menuColor;
                  }}
                >
                  {/* Shimmer effect */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(45deg, transparent 30%, ${menuColor}30 50%, transparent 70%)`,
                    animation: 'shimmer 3s infinite',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }} />

                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#00ff00',
                    boxShadow: '0 0 12px #00ff00',
                    animation: 'pulse 2s infinite',
                    zIndex: 2,
                    position: 'relative',
                  }} />

                  <div style={{
                    flex: 1,
                    zIndex: 2,
                    position: 'relative',
                  }}>
                    <div style={{
                      color: '#00ffff',
                      fontSize: '1.2em',
                      fontWeight: 'bold',
                      textShadow: '0 0 8px #00ffff',
                      marginBottom: '4px',
                    }}>
                      Slush Wallet
                    </div>
                    <div style={{
                      color: '#ffffff',
                      fontSize: '0.9em',
                      opacity: 0.9,
                    }}>
                      Secure blockchain authentication
                    </div>
                  </div>

                  <div style={{
                    color: menuColor,
                    fontSize: '1.5em',
                    textShadow: `0 0 8px ${menuColor}`,
                    zIndex: 2,
                    position: 'relative',
                  }}>
                    →
                  </div>
                </div>

                <div style={{
                  background: 'rgba(0, 255, 255, 0.1)',
                  border: '2px solid #00ffff',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '15px',
                  fontSize: '0.9em',
                }}>
                  <div style={{
                    color: '#00ffff',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    textShadow: '0 0 6px #00ffff',
                  }}>
                    🔐 Secure Sign-In Process:
                  </div>
                  <div style={{ color: '#ffffff', lineHeight: '1.5' }}>
                    1. Tap "Connect with Slush Wallet"<br />
                    2. Get redirected to Slush wallet app<br />
                    3. Review and sign authentication message<br />
                    4. Return to SU Messaging automatically
                  </div>
                </div>

                <div style={{
                  textAlign: 'center',
                  color: menuColor,
                  fontSize: '0.8em',
                  opacity: 0.8,
                  textShadow: `0 0 4px ${menuColor}`,
                }}>
                  Your connection is encrypted and secure
                </div>
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
              justifyContent: 'center',
              padding: '15px',
            }}
          >
            <Button
              variant="secondary"
              onClick={() => setShowWalletModal(false)}
              style={{
                backgroundColor: "transparent",
                border: `2px solid ${menuColor}`,
                color: menuColor,
                textShadow: "0 0 6px #00ffff",
                padding: "10px 20px",
                fontSize: "1em",
                borderRadius: "12px",
                transition: "all 0.3s",
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 'bold',
                minWidth: '120px',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = `${menuColor}20`;
                e.target.style.color = "#00ffff";
                e.target.style.boxShadow = `0 0 15px ${menuColor}40`;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "transparent";
                e.target.style.color = menuColor;
                e.target.style.boxShadow = 'none';
              }}
            >
              Cancel
            </Button>
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

        {/* Desktop Wallet Connect Modal */}
        <Modal
          show={showWalletConnectModal}
          onHide={() => setShowWalletConnectModal(false)}
          centered
          size="md"
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Modal.Header
            style={{
              background: 'linear-gradient(135deg, #1a0033, #330066)',
              borderBottom: `2px solid ${menuColor}`,
              color: '#00ffff',
              fontFamily: 'Orbitron, sans-serif',
            }}
          >
            <Modal.Title style={{ textShadow: '0 0 12px #00ffff' }}>
              🔗 Connect Wallet
            </Modal.Title>
          </Modal.Header>
          <Modal.Body
            style={{
              background: '#1a0033',
              color: '#00ffff',
              textShadow: '0 0 4px #ff00ff',
              padding: '25px',
            }}
          >
            <p style={{ marginBottom: '20px', fontSize: '1.1em' }}>
              Choose your wallet to connect and start using SU Messaging:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {wallets.map((wallet, index) => (
                <div
                  key={wallet.name}
                  onClick={() => {
                    console.log('Connecting to wallet:', wallet);
                    connect.mutate({ wallet });
                    setShowWalletConnectModal(false);
                  }}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    background: `linear-gradient(135deg, ${menuColor}10, ${menuColor}20)`,
                    border: `2px solid ${menuColor}40`,
                    borderRadius: '12px',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: '1.1em',
                    fontWeight: '500',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = `linear-gradient(135deg, ${menuColor}20, ${menuColor}30)`;
                    e.target.style.borderColor = menuColor;
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = `0 0 20px ${menuColor}40`;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = `linear-gradient(135deg, ${menuColor}10, ${menuColor}20)`;
                    e.target.style.borderColor = `${menuColor}40`;
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: menuColor,
                    boxShadow: `0 0 8px ${menuColor}`,
                    animation: 'pulse 2s infinite',
                  }} />
                  <span style={{
                    color: '#00ffff',
                    textShadow: '0 0 6px #00ffff',
                  }}>
                    {wallet.name}
                  </span>
                  <div style={{ marginLeft: 'auto' }}>
                    <span style={{
                      color: menuColor,
                      fontSize: '1.2em',
                      textShadow: `0 0 8px ${menuColor}`,
                    }}>
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: '20px',
              padding: '12px',
              background: 'rgba(0, 255, 255, 0.1)',
              border: '1px solid #00ffff',
              borderRadius: '8px',
            }}>
              <strong style={{ color: '#00ffff' }}>🔐 Secure Connection:</strong>
              <br />
              <small style={{ color: '#ffffff' }}>
                Your wallet connection is secure and encrypted. You'll be redirected to sign an authentication message to prove ownership.
              </small>
            </div>
          </Modal.Body>
          <Modal.Footer
            style={{
              background: 'linear-gradient(135deg, #1a0033, #330066)',
              borderTop: `2px solid ${menuColor}`,
            }}
          >
            <Button
              variant="secondary"
              onClick={() => setShowWalletConnectModal(false)}
              style={{
                backgroundColor: 'transparent',
                borderColor: menuColor,
                color: menuColor,
                textShadow: '0 0 4px #00ffff',
                padding: '6px 15px',
                fontSize: '1em',
                borderRadius: '8px',
                transition: 'all 0.3s',
                fontFamily: 'Orbitron, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = `${menuColor}20`;
                e.target.style.color = '#00ffff';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = menuColor;
              }}
            >
              Cancel
            </Button>
          </Modal.Footer>
        </Modal>
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
