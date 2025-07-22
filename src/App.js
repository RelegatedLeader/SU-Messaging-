import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import { Container, Navbar, Nav, Button, Modal, Form } from "react-bootstrap";
import {
  WalletProvider,
  defineSlushWallet,
  useWallet,
  ConnectButton,
} from "@suiet/wallet-kit"; // Use only Suiet wallet kit
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

// Define Slush Wallet configuration
const slushWalletConfig = defineSlushWallet({
  appName: "SU-Messaging", // Your dApp name, displayed in Slush
  network: "testnet", // Match the SuiClient network
});

function AppContent() {
  const [userName, setUserName] = useState("");
  const [menuColor, setMenuColor] = useState("#ff00ff"); // Default to pink from Chat.js
  const [showWalletModal, setShowWalletModal] = useState(false);
  const wallet = useWallet(); // Use Suiet wallet hook
  const isConnected = wallet.status === "connected";
  const currentAccount = wallet.account;
  const [selectedWallet, setSelectedWallet] = useState("");

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
          await wallet.select("slush-wallet"); // Select Slush wallet
          // Removed await connect() as it's not needed with Suiet kit
          setShowWalletModal(false); // Close modal
          window.location.href = "https://su-messaging.netlify.app"; // Redirect back to site to refresh state after signing
        } catch (error) {
          console.error("Connection failed:", error);
          // Redirect to app store based on platform if connection fails (app likely not installed)
          if (navigator.userAgent.match(/iPhone|iPad|iPod/)) {
            window.location.href =
              "https://apps.apple.com/us/app/slush-a-sui-wallet/id6476572140";
          } else {
            window.location.href =
              "https://play.google.com/store/apps/details?id=com.mystenlabs.suiwallet";
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
            ) : (
              <ConnectButton
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
              />
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
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
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
  return (
    <Router>
      <WalletProvider
        defaultWallets={[slushWalletConfig]} // Configure Slush Web Wallet
      >
        <AppContent />
      </WalletProvider>
    </Router>
  );
}

export default App;
