import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert } from "react-bootstrap";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useWalletKit } from "@mysten/wallet-kit";

function Settings() {
  const { signAndExecuteTransactionBlock, isConnected } = useWalletKit();
  const [displayName, setDisplayName] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [error, setError] = useState(null);
  const [encryptMessages, setEncryptMessages] = useState(false);
  const [disableWalletPopup, setDisableWalletPopup] = useState(
    localStorage.getItem("disableWalletPopup") === "true"
  );

  useEffect(() => {
    // Load current display name (placeholder logic; we'll fetch from blockchain later)
    const savedName = localStorage.getItem("currentDisplayName");
    if (savedName) setCurrentName(savedName);
  }, []);

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
        "0x62c1db5b7060a2d7207430b62c94dcfa50aaf1d5a09fb3a39f2869c86cd6f61b";

      tx.moveCall({
        target: `${packageId}::su_messaging::register`,
        arguments: [tx.pure(displayName)],
      });

      const result = await signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: disableWalletPopup
          ? { showEffects: true }
          : { showEffects: true, showObjectChanges: true }, // Simplified for now; adjust SDK for true disable later
      });

      localStorage.setItem("currentDisplayName", displayName); // Store the name locally
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
    // Note: True wallet pop-up disable requires SDK/wallet integration; this is a placeholder.
  };

  return (
    <Container className="mt-5">
      <h2 className="text-center">Settings</h2>
      <div className="mt-4">
        <Form
          onSubmit={handleRegisterOrUpdate}
          className="mx-auto"
          style={{ maxWidth: "400px" }}
        >
          <Form.Group controlId="displayName">
            <Form.Label>Update Display Name on SUI Blockchain</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              style={{
                backgroundColor: "var(--accent-dark)",
                color: "var(--text-primary)",
                borderColor: "var(--primary-blue)",
              }}
            />
          </Form.Group>
          <Form.Group controlId="encryptMessages" className="mt-3">
            <Form.Check
              type="switch"
              label="Enable Message Encryption"
              checked={encryptMessages}
              onChange={(e) => setEncryptMessages(e.target.checked)}
              style={{ color: "var(--text-primary)" }}
            />
          </Form.Group>
          <Form.Group controlId="disableWalletPopup" className="mt-3">
            <Form.Check
              type="switch"
              label="Disable Wallet Pop-up (Free Option)"
              checked={disableWalletPopup}
              onChange={handleToggleWalletPopup}
              style={{ color: "var(--text-primary)" }}
            />
          </Form.Group>
          <Button
            variant="primary"
            type="submit"
            className="mt-3"
            style={{
              backgroundColor: "var(--primary-blue)",
              borderColor: "var(--primary-blue)",
            }}
          >
            {currentName ? "Update Profile" : "Register"}
          </Button>
        </Form>
        {registrationStatus && (
          <Alert variant="success" className="mt-3">
            {registrationStatus}
          </Alert>
        )}
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </div>
    </Container>
  );
}

export default Settings;
