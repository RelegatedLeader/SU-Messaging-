import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert } from "react-bootstrap";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useWalletKit } from "@mysten/wallet-kit";
import { SuiClient } from "@mysten/sui.js/client";

function Settings() {
  const { signAndExecuteTransactionBlock, isConnected, currentAccount } =
    useWalletKit();
  const [displayName, setDisplayName] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [error, setError] = useState(null);
  const [encryptMessages, setEncryptMessages] = useState(false);
  const [disableWalletPopup, setDisableWalletPopup] = useState(
    localStorage.getItem("disableWalletPopup") === "true"
  );
  const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });

  useEffect(() => {
    const fetchCurrentName = async () => {
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
        const savedName = userObject?.data.content.fields.display_name
          ? new TextDecoder().decode(
              new Uint8Array(userObject.data.content.fields.display_name)
            )
          : localStorage.getItem("currentDisplayName");
        setCurrentName(savedName || currentAccount.address.slice(0, 6) + "...");
        if (savedName) setDisplayName(savedName);
      }
    };
    fetchCurrentName();
  }, [isConnected, currentAccount]);

  const handleRegisterOrUpdate = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      setError("Please connect your wallet first.");
      return;
    }

    setError(null);
    setRegistrationStatus(null);

    try {
      const tx = new TransactionBlock();
      const packageId =
        "0x3f455d572c2b923918a0623bef2e075b9870dc650c2f9e164aa2ea5693506d80";

      tx.moveCall({
        target: `${packageId}::su_messaging::register`,
        arguments: [tx.pure(displayName)],
      });

      const result = await signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: disableWalletPopup
          ? { showEffects: true }
          : { showEffects: true, showObjectChanges: true },
      });

      localStorage.setItem("currentDisplayName", displayName);
      setCurrentName(displayName);
      setRegistrationStatus(
        displayName === currentName
          ? "Profile updated!"
          : "Registration successful!"
      );
      console.log("Registration/Update result:", result);
    } catch (err) {
      setError("Registration failed: " + err.message);
      console.error(err);
    }
  };

  const handleToggleWalletPopup = () => {
    const newValue = !disableWalletPopup;
    setDisableWalletPopup(newValue);
    localStorage.setItem("disableWalletPopup", newValue);
  };

  return (
    <Container
      className="mt-5"
      style={{
        maxWidth: "1200px",
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "linear-gradient(135deg, #1a0033, #330066)",
        border: "5px solid #ff00ff",
        borderRadius: "10px",
        boxShadow: "0 0 20px #00ffff",
        fontFamily: "Orbitron, sans-serif",
        color: "#00ffff",
      }}
    >
      <h2
        className="text-center"
        style={{ textShadow: "0 0 15px #00ffff", marginBottom: "20px" }}
      >
        Settings
      </h2>
      <div className="mt-4">
        <Form
          onSubmit={handleRegisterOrUpdate}
          className="mx-auto"
          style={{
            maxWidth: "400px",
            border: "2px solid #ff00ff",
            padding: "15px",
            borderRadius: "8px",
          }}
        >
          <Form.Group controlId="displayName">
            <Form.Label style={{ textShadow: "0 0 5px #ff00ff" }}>
              Update Display Name on SUI Blockchain
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              style={{
                backgroundColor: "#1a0033",
                color: "#00ffff",
                border: "1px dashed #ff00ff",
                borderRadius: "5px",
                padding: "10px",
                fontSize: "14px",
                textShadow: "0 0 3px #ff00ff",
              }}
            />
          </Form.Group>
          <Form.Group controlId="encryptMessages" className="mt-3">
            <Form.Check
              type="switch"
              label="Enable Message Encryption"
              checked={encryptMessages}
              onChange={(e) => setEncryptMessages(e.target.checked)}
              style={{ color: "#00ffff", textShadow: "0 0 3px #ff00ff" }}
            />
          </Form.Group>
          <Form.Group controlId="disableWalletPopup" className="mt-3">
            <Form.Check
              type="switch"
              label="Disable Wallet Pop-up (Free Option)"
              checked={disableWalletPopup}
              onChange={handleToggleWalletPopup}
              style={{ color: "#00ffff", textShadow: "0 0 3px #ff00ff" }}
            />
          </Form.Group>
          <Button
            variant="primary"
            type="submit"
            className="mt-3"
            style={{
              backgroundColor: "#ff00ff",
              borderColor: "#ff00ff",
              textShadow: "0 0 5px #00ffff",
              padding: "10px 20px",
              fontSize: "16px",
              transition: "background-color 0.3s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#ff00ff")}
          >
            {currentName ? "Update Profile" : "Register"}
          </Button>
        </Form>
        {registrationStatus && (
          <Alert
            variant="success"
            className="mt-3"
            style={{
              backgroundColor: "#330066",
              border: "1px solid #ff00ff",
              color: "#00ffff",
              textShadow: "0 0 3px #ff00ff",
            }}
          >
            {registrationStatus}
          </Alert>
        )}
        {error && (
          <Alert
            variant="danger"
            className="mt-3"
            style={{
              backgroundColor: "#330066",
              border: "1px solid #ff00ff",
              color: "#ff0000",
            }}
          >
            {error}
          </Alert>
        )}
      </div>
    </Container>
  );
}

export default Settings;
