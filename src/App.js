import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import { Container, Navbar, Nav, Button, Modal, Form } from "react-bootstrap";
import { useCurrentWallet, useConnectWallet, useWallets, useDisconnectWallet, ConnectButton } from "@mysten/dapp-kit";
import { SuiClient } from "@mysten/sui.js/client";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";
import logo from "./img/su-logo.png";
import Dashboard from "./Dashboard";
import Chat from "./Chat";
import Settings from "./Settings";

function AppContent() {
  const { currentAccount, isConnected } = useCurrentWallet();
  const { mutate: connect } = useConnectWallet();
  const wallets = useWallets();
  const { mutate: disconnect } = useDisconnectWallet();
  const [userName, setUserName] = useState("");
  const [menuColor, setMenuColor] = useState("#ff00ff"); // Default to pink from Chat.js
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showWalletSelect, setShowWalletSelect] = useState(false);

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
            "0x3c7d131d38c117cbc75e3a8349ea3c841776ad6c6168e9590ba1fc4478018799::su_messaging::User"
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

  const handleDashboardClick = (e) => {
    if (!isConnected) {
      e.preventDefault();
      setShowWalletModal(true);
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
                onClick={() => setShowWalletSelect(true)}
                style={{
                  background: "linear-gradient(135deg, #00ffff 0%, #0080ff 50%, #8000ff 100%)",
                  border: "2px solid rgba(0, 255, 255, 0.5)",
                  color: "#ffffff",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  fontFamily: "Orbitron, sans-serif",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: "0 4px 15px rgba(0, 255, 255, 0.2), 0 0 30px rgba(0, 255, 255, 0.1)",
                  textShadow: "0 0 8px rgba(255, 255, 255, 0.8)",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "translateY(-1px) scale(1.02)";
                  e.target.style.boxShadow = "0 6px 20px rgba(0, 255, 255, 0.3), 0 0 40px rgba(0, 255, 255, 0.2)";
                  e.target.style.background = "linear-gradient(135deg, #00cccc 0%, #0066cc 50%, #6600cc 100%)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "translateY(0) scale(1)";
                  e.target.style.boxShadow = "0 4px 15px rgba(0, 255, 255, 0.2), 0 0 30px rgba(0, 255, 255, 0.1)";
                  e.target.style.background = "linear-gradient(135deg, #00ffff 0%, #0080ff 50%, #8000ff 100%)";
                }}
              >
                Connect Wallet
              </Button>
            ) : (
              <button
                onClick={() => isConnected ? disconnect() : setShowWalletSelect(true)}
                style={{
                  background: isConnected 
                    ? "linear-gradient(135deg, #00aa00 0%, #008800 50%, #006600 100%)"
                    : "linear-gradient(135deg, #00ffff 0%, #0080ff 50%, #8000ff 100%)",
                  border: `2px solid ${isConnected ? "rgba(0, 170, 0, 0.5)" : "rgba(0, 255, 255, 0.5)"}`,
                  color: "#ffffff",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  fontFamily: "Orbitron, sans-serif",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: `0 4px 15px ${isConnected ? "rgba(0, 170, 0, 0.2)" : "rgba(0, 255, 255, 0.2)"}, 0 0 30px ${isConnected ? "rgba(0, 170, 0, 0.1)" : "rgba(0, 255, 255, 0.1)"}`,
                  textShadow: "0 0 8px rgba(255, 255, 255, 0.8)",
                  position: "relative",
                  overflow: "hidden",
                  minWidth: isConnected ? "140px" : "120px",
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "translateY(-1px) scale(1.02)";
                  e.target.style.boxShadow = `0 6px 20px ${isConnected ? "rgba(0, 170, 0, 0.3)" : "rgba(0, 255, 255, 0.3)"}, 0 0 40px ${isConnected ? "rgba(0, 170, 0, 0.2)" : "rgba(0, 255, 255, 0.2)"}`;
                  e.target.style.background = isConnected 
                    ? "linear-gradient(135deg, #008800 0%, #006600 50%, #004400 100%)"
                    : "linear-gradient(135deg, #00cccc 0%, #0066cc 50%, #6600cc 100%)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "translateY(0) scale(1)";
                  e.target.style.boxShadow = `0 4px 15px ${isConnected ? "rgba(0, 170, 0, 0.2)" : "rgba(0, 255, 255, 0.2)"}, 0 0 30px ${isConnected ? "rgba(0, 170, 0, 0.1)" : "rgba(0, 255, 255, 0.1)"}`;
                  e.target.style.background = isConnected 
                    ? "linear-gradient(135deg, #00aa00 0%, #008800 50%, #006600 100%)"
                    : "linear-gradient(135deg, #00ffff 0%, #0080ff 50%, #8000ff 100%)";
                }}
              >
                {isConnected ? (
                  <>
                    <span style={{ fontSize: "0.8rem", marginRight: "4px" }}>🔗</span>
                    {currentAccount?.address ? 
                      `${currentAccount.address.slice(0, 6)}...${currentAccount.address.slice(-4)}` : 
                      "Connected"
                    }
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </button>
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
          element={
            isConnected ? (
              <Dashboard />
            ) : (
              <Navigate to="/" replace />
            )
          }
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
        size="lg"
        backdrop="static"
        style={{
          zIndex: 10000,
        }}
        dialogClassName="wallet-connect-modal"
      >
        <div style={{
          background: "linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 25px 50px rgba(0, 255, 255, 0.15), 0 0 100px rgba(255, 0, 255, 0.1)",
          border: "1px solid rgba(0, 255, 255, 0.3)",
          position: "relative",
        }}>
          {/* Animated background particles */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(circle at 20% 80%, rgba(0, 255, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(255, 0, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 40% 40%, rgba(0, 255, 0, 0.05) 0%, transparent 50%)
            `,
            animation: "float 6s ease-in-out infinite",
          }}></div>

          <Modal.Header style={{
            background: "transparent",
            borderBottom: "1px solid rgba(0, 255, 255, 0.2)",
            padding: "30px 40px 20px",
            position: "relative",
            zIndex: 2,
          }}>
            <div style={{ textAlign: "center", width: "100%" }}>
              <div style={{
                fontSize: "3.5rem",
                marginBottom: "15px",
                animation: "glow 2s ease-in-out infinite alternate",
              }}>
                🚀
              </div>
              <Modal.Title style={{
                color: "#ffffff",
                fontFamily: "Orbitron, sans-serif",
                fontSize: "2rem",
                fontWeight: "700",
                textShadow: "0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.4)",
                margin: 0,
                letterSpacing: "2px",
              }}>
                CONNECT WALLET
              </Modal.Title>
              <div style={{
                height: "3px",
                background: "linear-gradient(90deg, transparent, #00ffff, transparent)",
                margin: "15px auto 0",
                width: "60%",
                borderRadius: "2px",
              }}></div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={() => setShowWalletModal(false)}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                filter: "drop-shadow(0 0 5px rgba(255, 255, 255, 0.5))",
              }}
            ></button>
          </Modal.Header>

          <Modal.Body style={{
            padding: "40px",
            textAlign: "center",
            position: "relative",
            zIndex: 2,
          }}>
            <div style={{
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "15px",
              padding: "30px",
              marginBottom: "30px",
              border: "1px solid rgba(0, 255, 255, 0.2)",
              backdropFilter: "blur(10px)",
            }}>
              <div style={{
                fontSize: "4rem",
                marginBottom: "20px",
                animation: "bounce 3s ease-in-out infinite",
              }}>
                🔐
              </div>
              <h4 style={{
                color: "#00ffff",
                fontFamily: "Orbitron, sans-serif",
                fontSize: "1.3rem",
                marginBottom: "15px",
                textShadow: "0 0 10px rgba(0, 255, 255, 0.6)",
              }}>
                SECURE BLOCKCHAIN ACCESS
              </h4>
              <p style={{
                color: "rgba(255, 255, 255, 0.8)",
                fontSize: "1rem",
                lineHeight: "1.6",
                margin: 0,
                textShadow: "0 0 5px rgba(255, 255, 255, 0.3)",
              }}>
                Connect your wallet to access the decentralized SU messaging platform.
                Your security and privacy are our top priorities.
              </p>
            </div>

            <ConnectButton
              style={{
                background: "linear-gradient(135deg, #00ffff 0%, #0080ff 50%, #8000ff 100%)",
                border: "none",
                color: "#ffffff",
                fontSize: "1.2rem",
                fontWeight: "600",
                fontFamily: "Orbitron, sans-serif",
                padding: "15px 40px",
                borderRadius: "30px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                boxShadow: "0 8px 25px rgba(0, 255, 255, 0.3), 0 0 50px rgba(0, 255, 255, 0.1)",
                textShadow: "0 0 10px rgba(255, 255, 255, 0.8)",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px) scale(1.05)";
                e.target.style.boxShadow = "0 12px 35px rgba(0, 255, 255, 0.4), 0 0 70px rgba(0, 255, 255, 0.2)";
                e.target.style.background = "linear-gradient(135deg, #00cccc 0%, #0066cc 50%, #6600cc 100%)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0) scale(1)";
                e.target.style.boxShadow = "0 8px 25px rgba(0, 255, 255, 0.3), 0 0 50px rgba(0, 255, 255, 0.1)";
                e.target.style.background = "linear-gradient(135deg, #00ffff 0%, #0080ff 50%, #8000ff 100%)";
              }}
            />

            <div style={{
              marginTop: "20px",
              fontSize: "0.9rem",
              color: "rgba(255, 255, 255, 0.6)",
              textShadow: "0 0 3px rgba(255, 255, 255, 0.3)",
            }}>
              Supported wallets: MetaMask, Sui Wallet, and more
            </div>
          </Modal.Body>
        </div>
      </Modal>

      {/* Custom Wallet Selection Modal */}
      <Modal
        show={showWalletSelect}
        onHide={() => setShowWalletSelect(false)}
        centered
        size="lg"
        backdrop="static"
        style={{
          zIndex: 10002,
        }}
        dialogClassName="wallet-select-modal"
      >
        <div style={{
          background: "linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 25px 50px rgba(0, 255, 255, 0.15), 0 0 100px rgba(255, 0, 255, 0.1)",
          border: "1px solid rgba(0, 255, 255, 0.3)",
          position: "relative",
          animation: "modalPop 0.3s ease-out",
        }}>
          {/* Animated background particles */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(circle at 20% 80%, rgba(0, 255, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(255, 0, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 40% 40%, rgba(0, 255, 0, 0.05) 0%, transparent 50%)
            `,
            animation: "float 6s ease-in-out infinite",
          }}></div>

          <Modal.Header style={{
            background: "transparent",
            borderBottom: "1px solid rgba(0, 255, 255, 0.2)",
            padding: "30px 40px 20px",
            position: "relative",
            zIndex: 2,
          }}>
            <div style={{ textAlign: "center", width: "100%" }}>
              <div style={{
                fontSize: "3.5rem",
                marginBottom: "15px",
                animation: "glow 2s ease-in-out infinite alternate",
              }}>
                🚀
              </div>
              <Modal.Title style={{
                color: "#ffffff",
                fontFamily: "Orbitron, sans-serif",
                fontSize: "2rem",
                fontWeight: "700",
                textShadow: "0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.4)",
                margin: 0,
                letterSpacing: "2px",
              }}>
                CHOOSE YOUR WALLET
              </Modal.Title>
              <div style={{
                height: "3px",
                background: "linear-gradient(90deg, transparent, #00ffff, transparent)",
                margin: "15px auto 0",
                width: "60%",
                borderRadius: "2px",
              }}></div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={() => setShowWalletSelect(false)}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                filter: "drop-shadow(0 0 5px rgba(255, 255, 255, 0.5))",
              }}
            ></button>
          </Modal.Header>

          <Modal.Body style={{
            padding: "40px",
            position: "relative",
            zIndex: 2,
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "20px",
              marginBottom: "30px",
            }}>
              {wallets.map((wallet) => (
                <div
                  key={wallet.name}
                  onClick={() => {
                    connect({ wallet });
                    setShowWalletSelect(false);
                  }}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "2px solid rgba(0, 255, 255, 0.3)",
                    borderRadius: "15px",
                    padding: "25px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    backdropFilter: "blur(10px)",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-5px) scale(1.02)";
                    e.target.style.boxShadow = "0 10px 30px rgba(0, 255, 255, 0.3)";
                    e.target.style.borderColor = "#00ffff";
                    e.target.style.background = "rgba(0, 255, 255, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0) scale(1)";
                    e.target.style.boxShadow = "none";
                    e.target.style.borderColor = "rgba(0, 255, 255, 0.3)";
                    e.target.style.background = "rgba(255, 255, 255, 0.05)";
                  }}
                >
                  <div style={{ fontSize: "3rem", marginBottom: "15px" }}>
                    {wallet.name.toLowerCase().includes('sui') ? '🌀' : 
                     wallet.name.toLowerCase().includes('ethos') ? '⚡' : 
                     wallet.name.toLowerCase().includes('burner') ? '🔥' : '👛'}
                  </div>
                  <div style={{
                    color: "#00ffff",
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "1.2rem",
                    fontWeight: "600",
                    textShadow: "0 0 10px rgba(0, 255, 255, 0.6)",
                  }}>
                    {wallet.name.toUpperCase()}
                  </div>
                  <div style={{
                    color: "rgba(255, 255, 255, 0.7)",
                    fontSize: "0.9rem",
                    marginTop: "5px",
                  }}>
                    {wallet.name}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "0.9rem",
            }}>
              Select your preferred wallet to connect
            </div>
          </Modal.Body>
        </div>
      </Modal>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
