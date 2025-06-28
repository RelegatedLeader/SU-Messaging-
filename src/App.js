import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import { Container, Navbar, Nav, Button } from "react-bootstrap";
import {
  WalletKitProvider,
  useWalletKit,
  ConnectButton,
} from "@mysten/wallet-kit";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { SuiClient } from "@mysten/sui.js/client";
import logo from "./img/su-logo.png";
import Dashboard from "./Dashboard";
import Chat from "./Chat";
import Settings from "./Settings";

function AppContent() {
  const [userName, setUserName] = useState("");
  const { isConnected, currentAccount } = useWalletKit(); // Safe within WalletKitProvider
  const client = new SuiClient({ url: "https://fullnode.devnet.sui.io:443" });

  useEffect(() => {
    const fetchUserName = async () => {
      if (isConnected && currentAccount) {
        const objects = await client.getOwnedObjects({
          owner: currentAccount.address,
          options: { showType: true, showContent: true },
        });
        const userObject = objects.data.find((obj) =>
          obj.data.type.includes(
            "0x62c1db5b7060a2d7207430b62c94dcfa50aaf1d5a09fb3a39f2869c86cd6f61b::su_messaging::User"
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
  }, [isConnected, currentAccount]);

  const handleFreeFlowClick = () => {
    console.log("FreeFlow Mode selected!");
  };

  return (
    <Router>
      <div>
        <Navbar bg="dark" variant="dark" expand="lg">
          <Container>
            <Navbar.Brand className="d-flex align-items-center gap-2">
              <Link to="/">
                <img
                  src={logo}
                  alt="SU Logo"
                  style={{ width: "40px", height: "40px" }}
                />
              </Link>
              <Link to="/" className="text-white text-decoration-none">
                <span>{userName || "SU"}</span>
              </Link>
            </Navbar.Brand>
            <Nav className="ms-auto d-flex align-items-center">
              <Nav.Link as={Link} to="/settings" className="text-white me-2">
                Settings
              </Nav.Link>
              <ConnectButton />
            </Nav>
          </Container>
        </Navbar>
        <Routes>
          <Route
            path="/"
            element={
              <Container className="mt-5 text-center">
                <h1 className="d-flex align-items-center justify-content-center gap-2">
                  Welcome to {userName || "SU"}
                  <img
                    src={logo}
                    alt="SU Logo"
                    style={{ width: "50px", height: "50px" }}
                  />
                </h1>
                <p className="text-secondary">
                  A decentralized messaging app powered by the SUI blockchain.
                </p>
                <p className="text-secondary">
                  Connect your wallet for Web3 mode or try FreeFlow Mode for
                  beginners!
                </p>
                <div className="mt-4">
                  <Button
                    variant="primary"
                    className="mx-2"
                    style={{
                      backgroundColor: "var(--primary-blue)",
                      borderColor: "var(--primary-blue)",
                    }}
                    onClick={handleFreeFlowClick}
                  >
                    Try FreeFlow Mode
                  </Button>
                  <Button
                    as={Link}
                    to="/dashboard"
                    variant="outline-primary"
                    className="mx-2"
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </Container>
            }
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <WalletKitProvider>
      <AppContent />
    </WalletKitProvider>
  );
}

export default App;
