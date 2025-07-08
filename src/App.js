import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import { Container, Navbar, Nav, Button, Modal } from "react-bootstrap";
import {
  WalletKitProvider,
  useWalletKit,
  ConnectButton,
} from "@mysten/wallet-kit";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";
import { SuiClient } from "@mysten/sui.js/client";
import logo from "./img/su-logo.png";
import Dashboard from "./Dashboard";
import Chat from "./Chat";
import Settings from "./Settings";

function AppContent() {
  const [userName, setUserName] = useState("");
  const [menuColor, setMenuColor] = useState("#ff00ff"); // Default to pink from Chat.js
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { isConnected, currentAccount } = useWalletKit();
  const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });

  useEffect(() => {
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
          border: `5px solid ${menuColor}`,
          borderRadius: "15px",
          boxShadow: "0 0 25px rgba(0, 255, 255, 0.8)",
          fontFamily: "Orbitron, sans-serif",
          color: "#00ffff",
          background: "linear-gradient(135deg, #1a0033, #440088)",
          padding: "10px 20px",
        }}
      >
        <Container>
          <Navbar.Brand className="d-flex align-items-center gap-3">
            <Link to="/">
              <img
                src={logo}
                alt="SU Logo"
                style={{
                  width: "50px",
                  height: "50px",
                  border: `3px solid ${menuColor}`,
                  borderRadius: "10px",
                }}
              />
            </Link>
            <Link to="/" className="text-white text-decoration-none">
              <span
                style={{ textShadow: "0 0 15px #00ffff", fontSize: "1.2em" }}
              >
                {userName || "SU"}
              </span>
            </Link>
          </Navbar.Brand>
          <Nav className="ms-auto d-flex align-items-center">
            <Nav.Link
              as={Link}
              to="/settings"
              className="text-white me-3"
              style={{
                textShadow: "0 0 8px #00ffff",
                transition: "color 0.4s",
                color: menuColor,
                fontSize: "1.1em",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#00ffff")}
              onMouseLeave={(e) => (e.target.style.color = menuColor)}
            >
              Settings
            </Nav.Link>
            <ConnectButton
              style={{
                backgroundColor: menuColor,
                borderColor: menuColor,
                textShadow: "0 0 8px #00ffff",
                fontSize: "1.1em",
                padding: "8px 20px",
                borderRadius: "10px",
                transition: "background-color 0.4s",
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
            />
          </Nav>
        </Container>
      </Navbar>
      <Routes>
        <Route
          path="/"
          element={
            <Container
              className="mt-5 text-center"
              style={{
                background: "linear-gradient(135deg, #1a0033, #440088)",
                border: `5px solid ${menuColor}`,
                borderRadius: "15px",
                boxShadow: "0 0 25px #00ffff",
                color: "#00ffff",
                fontFamily: "Orbitron, sans-serif",
                padding: "30px",
              }}
            >
              <h1
                className="d-flex align-items-center justify-content-center gap-3"
                style={{ textShadow: "0 0 20px #00ffff", fontSize: "2.5em" }}
              >
                Welcome to {userName || "SU"}
                <img
                  src={logo}
                  alt="SU Logo"
                  style={{
                    width: "60px",
                    height: "60px",
                    border: `3px solid ${menuColor}`,
                    borderRadius: "10px",
                  }}
                />
              </h1>
              <p style={{ textShadow: "0 0 8px #ff00ff", fontSize: "1.2em" }}>
                A decentralized messaging app powered by the SUI blockchain.
              </p>
              <div className="mt-5">
                <Button
                  as={Link}
                  to="/dashboard"
                  variant="outline-primary"
                  className="mx-2"
                  style={{
                    borderColor: menuColor,
                    color: menuColor,
                    textShadow: "0 0 8px #00ffff",
                    padding: "12px 25px",
                    fontSize: "1.2em",
                    borderRadius: "10px",
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
          <Modal.Title style={{ textShadow: "0 0 15px #00ffff" }}>
            Wallet Required
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          style={{
            background: "#1a0033",
            color: "#00ffff",
            textShadow: "0 0 5px #ff00ff",
            fontSize: "1.1em",
          }}
        >
          Please connect your wallet to access the Dashboard and enjoy the full
          SU experience!
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
              textShadow: "0 0 8px #00ffff",
              padding: "8px 20px",
              borderRadius: "10px",
              transition: "background-color 0.4s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
          >
            Close
          </Button>
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
