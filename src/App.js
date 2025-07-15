import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import { Container, Navbar, Nav, Button, Modal } from "react-bootstrap";
import {
  WalletKitProvider,
  useWalletKit,
  ConnectButton,
} from "@mysten/wallet-kit";
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

// Optional: Uncomment and install with `npm install qrcode.react` if you want QR codes
// import QRCode from "qrcode.react";

function AppContent() {
  const [userName, setUserName] = useState("");
  const [menuColor, setMenuColor] = useState("#ff00ff"); // Default to pink from Chat.js
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { isConnected, currentAccount } = useWalletKit();

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

  const handleWebConnect = () => {
    // Mobile-native wallet connection (e.g., QR code or deep link)
    if (window.innerWidth < 768) {
      // Option 1: QR Code (uncomment and install qrcode.react if desired)
      // return <QRCode value="your-wallet-connection-url" />; // Replace with actual URL

      // Option 2: Placeholder with alert (current implementation)
      alert(
        "Scan this QR code or use the deep link to connect your mobile wallet. (Implement QR code generation here, e.g., with qrcode.react)"
      );
    }
    setShowWalletModal(false);
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
          border: `4px solid ${menuColor}`, // Slightly reduced border thickness
          borderRadius: "12px", // Slightly reduced radius
          boxShadow: "0 0 20px rgba(0, 255, 255, 0.7)", // Reduced shadow intensity
          fontFamily: "Orbitron, sans-serif",
          color: "#00ffff",
          background: "linear-gradient(135deg, #1a0033, #440088)",
          padding: "8px 15px", // Reduced padding
        }}
      >
        <Container>
          <Navbar.Brand className="d-flex align-items-center gap-2">
            <Link to="/">
              <img
                src={logo}
                alt="SU Logo"
                style={{
                  width: "40px", // Reduced size
                  height: "40px", // Reduced size
                  border: `2px solid ${menuColor}`, // Reduced border thickness
                  borderRadius: "8px", // Reduced radius
                }}
              />
            </Link>
            <Link to="/" className="text-white text-decoration-none">
              <span
                style={{ textShadow: "0 0 12px #00ffff", fontSize: "1.1em" }} // Reduced font size
              >
                {userName || "SU"}
              </span>
            </Link>
          </Navbar.Brand>
          <Nav className="ms-auto d-flex align-items-center">
            <Nav.Link
              as={Link}
              to="/settings"
              className="text-white me-2" // Reduced margin
              style={{
                textShadow: "0 0 6px #00ffff", // Reduced shadow
                transition: "color 0.4s",
                color: menuColor,
                fontSize: "1em", // Reduced font size
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
                  textShadow: "0 0 6px #00ffff", // Reduced shadow
                  fontSize: "1em", // Reduced font size
                  padding: "6px 15px", // Reduced padding
                  borderRadius: "8px", // Reduced radius
                  transition: "background-color 0.4s",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = "#00ffff")
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor = menuColor)
                }
              >
                WebConnect
              </Button>
            ) : (
              <ConnectButton
                style={{
                  backgroundColor: menuColor,
                  borderColor: menuColor,
                  textShadow: "0 0 6px #00ffff", // Reduced shadow
                  fontSize: "1em", // Reduced font size
                  padding: "6px 15px", // Reduced padding
                  borderRadius: "8px", // Reduced radius
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
              className="mt-4 text-center" // Reduced margin
              style={{
                background: "linear-gradient(135deg, #1a0033, #440088)",
                border: `4px solid ${menuColor}`, // Reduced border thickness
                borderRadius: "12px", // Reduced radius
                boxShadow: "0 0 20px #00ffff", // Reduced shadow intensity
                color: "#00ffff",
                fontFamily: "Orbitron, sans-serif",
                padding: "20px", // Reduced padding
              }}
            >
              <h1
                className="d-flex align-items-center justify-content-center gap-2" // Reduced gap
                style={{
                  textShadow: "0 0 15px #00ffff", // Reduced shadow
                  fontSize: "2em", // Reduced font size
                }}
              >
                Welcome to {userName || "SU"}
                <img
                  src={logo}
                  alt="SU Logo"
                  style={{
                    width: "50px", // Reduced size
                    height: "50px", // Reduced size
                    border: `2px solid ${menuColor}`, // Reduced border thickness
                    borderRadius: "8px", // Reduced radius
                  }}
                />
              </h1>
              <p
                style={{
                  textShadow: "0 0 6px #ff00ff", // Reduced shadow
                  fontSize: "1.1em", // Reduced font size
                }}
              >
                A decentralized messaging app powered by the SUI blockchain.
              </p>
              <div className="mt-4">
                {" "}
                {/* Reduced margin */}
                <Button
                  as={Link}
                  to="/dashboard"
                  variant="outline-primary"
                  className="mx-2"
                  style={{
                    borderColor: menuColor,
                    color: menuColor,
                    textShadow: "0 0 6px #00ffff", // Reduced shadow
                    padding: "10px 20px", // Reduced padding
                    fontSize: "1.1em", // Reduced font size
                    borderRadius: "8px", // Reduced radius
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
            {" "}
            {/* Reduced shadow */}
            Wallet Required
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          style={{
            background: "#1a0033",
            color: "#00ffff",
            textShadow: "0 0 4px #ff00ff", // Reduced shadow
            fontSize: "1em", // Reduced font size
          }}
        >
          {window.innerWidth < 768
            ? "Please use the WebConnect option to connect your mobile wallet."
            : "Please connect your wallet to access the Dashboard and enjoy the full SU experience!"}
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
              textShadow: "0 0 6px #00ffff", // Reduced shadow
              padding: "6px 15px", // Reduced padding
              fontSize: "1em", // Reduced font size
              borderRadius: "8px", // Reduced radius
              transition: "background-color 0.4s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
          >
            Close
          </Button>
          {window.innerWidth < 768 && (
            <Button
              variant="primary"
              onClick={handleWebConnect}
              style={{
                backgroundColor: menuColor,
                borderColor: menuColor,
                textShadow: "0 0 6px #00ffff", // Reduced shadow
                padding: "6px 15px", // Reduced padding
                fontSize: "1em", // Reduced font size
                borderRadius: "8px", // Reduced radius
                transition: "background-color 0.4s",
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
            >
              WebConnect
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
      <WalletKitProvider>
        <AppContent />
      </WalletKitProvider>
    </Router>
  );
}

export default App;
