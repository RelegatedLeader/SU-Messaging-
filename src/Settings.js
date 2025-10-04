import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert, Modal } from "react-bootstrap";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { SuiClient } from "@mysten/sui/client";

function Settings() {
  const currentAccount = useCurrentAccount();
  const isConnected = !!currentAccount;
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const [displayName, setDisplayName] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [error, setError] = useState(null);
  const [nameChangeCount, setNameChangeCount] = useState(0);
  const [remainingFreeChanges, setRemainingFreeChanges] = useState(3);
  const [encryptMessages, setEncryptMessages] = useState(false);
  const [disableWalletPopup, setDisableWalletPopup] = useState(
    localStorage.getItem("disableWalletPopup") === "true"
  );
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [donationAmount, setDonationAmount] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  useEffect(() => {
    const fetchCurrentName = async () => {
      const client = new SuiClient({
        url: "https://fullnode.mainnet.sui.io:443",
      });
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
        const savedName = userObject?.data.content.fields.display_name
          ? new TextDecoder().decode(
              new Uint8Array(userObject.data.content.fields.display_name)
            )
          : localStorage.getItem("currentDisplayName");
        const changeCount = userObject?.data.content.fields.name_change_count || 0;
        setNameChangeCount(changeCount);
        setRemainingFreeChanges(Math.max(0, 3 - changeCount));
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
      const tx = new Transaction();
      const packageId =
        "0x3c7d131d38c117cbc75e3a8349ea3c841776ad6c6168e9590ba1fc4478018799";

      // Get the user's User object
      const client = new SuiClient({
        url: "https://fullnode.mainnet.sui.io:443",
      });
      const objects = await client.getOwnedObjects({
        owner: currentAccount.address,
        options: { showType: true, showContent: true },
      });
      const userObject = objects.data.find((obj) =>
        obj.data.type.includes(
          "0x3c7d131d38c117cbc75e3a8349ea3c841776ad6c6168e9590ba1fc4478018799::su_messaging::User"
        )
      );

      if (!userObject) {
        setError("User profile not found. Please register first.");
        return;
      }

      const userObjectId = userObject.data.objectId;

      // If this is the 4th or more change, add payment
      if (nameChangeCount >= 3) {
        // Add 0.001 SUI payment to the specified address
        tx.transferObjects(
          [
            tx.splitCoins(tx.gas, [
              tx.pure(Math.floor(0.001 * 1e9)), // 0.001 SUI in MIST
            ]),
          ],
          tx.pure(
            "0xd1b0ff621a6803c8f0cd8051359ce312ece62b485e010e32b58a99d5ec13201c"
          )
        );
      }

      tx.moveCall({
        target: `${packageId}::su_messaging::update_name`,
        arguments: [
          tx.object(userObjectId),
          tx.pure(displayName, "vector<u8>"),
          tx.object(tx.gas), // Pass gas coin for payment
        ],
      });

      const result = await signAndExecuteTransactionBlock({
        transaction: tx,
        options: disableWalletPopup
          ? { showEffects: true }
          : { showEffects: true, showObjectChanges: true },
      });

      localStorage.setItem("currentDisplayName", displayName);
      setCurrentName(displayName);
      setNameChangeCount(nameChangeCount + 1);
      setRemainingFreeChanges(Math.max(0, 3 - (nameChangeCount + 1)));
      setRegistrationStatus(
        nameChangeCount >= 3
          ? "Display name updated! (Paid change)"
          : `Display name updated! (${2 - nameChangeCount} free changes remaining)`
      );
      console.log("Name update result:", result);
    } catch (err) {
      setError("Name update failed: " + err.message);
      console.error(err);
    }
  };

  const handleToggleWalletPopup = () => {
    const newValue = !disableWalletPopup;
    setDisableWalletPopup(newValue);
    localStorage.setItem("disableWalletPopup", newValue);
  };

  const handleSubscribe = async () => {
    if (!isConnected) {
      setSubscriptionStatus("Please connect your wallet first.");
      return;
    }

    setError(null);
    setSubscriptionStatus(null);

    try {
      const tx = new Transaction();
      const subscriptionAmount = 0.5; // Approx. $10 worth of SUI (adjust based on current price)
      const donation = parseFloat(donationAmount) || 0;

      tx.transferObjects(
        [
          tx.splitCoins(tx.gas, [
            tx.pure(Math.floor(subscriptionAmount * 1e9)),
          ]),
        ],
        tx.pure(
          "0xd1b0ff621a6803c8f0cd8051359ce312ece62b485e010e32b58a99d5ec13201c"
        )
      );

      if (donation > 0) {
        tx.transferObjects(
          [tx.splitCoins(tx.gas, [tx.pure(Math.floor(donation * 1e9))])],
          tx.pure(
            "0xd1b0ff621a6803c8f0cd8051359ce312ece62b485e010e32b58a99d5ec13201c"
          )
        );
      }

      const result = await signAndExecuteTransactionBlock({
        transaction: tx,
        options: { showEffects: true },
      });

      setSubscriptionStatus("Subscription successful! Membership granted.");
      console.log("Subscription result:", result);
    } catch (err) {
      setSubscriptionStatus("Subscription failed: " + err.message);
      console.error(err);
    }
  };

  return (
    <Container
      className="mt-5 position-relative"
      style={{
        maxWidth: "1200px",
        minHeight: "600px",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #1a0033, #330066)",
        border: "5px solid #ff00ff",
        borderRadius: "15px",
        boxShadow: "0 0 20px #00ffff, 0 0 10px #ff00ff inset",
        fontFamily: "Orbitron, sans-serif",
        color: "#00ffff",
        padding: "10px",
        animation: "colorShift 10s infinite",
      }}
    >
      <style>{`
        @keyframes colorShift {
          0% { border-color: #ff00ff; background: linear-gradient(135deg, #1a0033, #330066); }
          33% { border-color: #00ffff; background: linear-gradient(135deg, #330066, #440088); }
          66% { border-color: #ff00ff; background: linear-gradient(135deg, #440088, #1a0033); }
          100% { border-color: #00ffff; background: linear-gradient(135deg, #1a0033, #330066); }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          cursor: "pointer",
        }}
        onClick={() => setShowSubscriptionModal(true)}
      >
        <div
          style={{
            width: "50px",
            height: "50px",
            background: "linear-gradient(45deg, #ffd700, #daa520)",
            borderRadius: "50%",
            animation: "eagleFlap 2s infinite",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxShadow: "0 0 10px #ffd700",
          }}
        >
          <span
            style={{
              color: "#000",
              fontSize: "20px",
              textShadow: "0 0 5px #fff",
            }}
          >
            🦅
          </span>
        </div>
        <style>{`
          @keyframes eagleFlap {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        `}</style>
      </div>
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
            boxShadow: "0 0 15px rgba(0, 255, 255, 0.5)",
            background: "rgba(26, 0, 51, 0.8)",
            animation: "formColorShift 10s infinite",
          }}
        >
          <style>{`
            @keyframes formColorShift {
              0% { border-color: #ff00ff; }
              33% { border-color: #00ffff; }
              66% { border-color: #ff00ff; }
              100% { border-color: #ff00ff; }
            }
          `}</style>
          <Form.Group controlId="displayName">
            <Form.Label style={{ textShadow: "0 0 5px #ff00ff" }}>
              Update Display Name on SUI Blockchain
              {remainingFreeChanges > 0 ? (
                <div style={{ fontSize: "12px", color: "#00ffff", marginTop: "5px" }}>
                  {remainingFreeChanges} free change{remainingFreeChanges !== 1 ? "s" : ""} remaining
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: "#ffd700", marginTop: "5px" }}>
                  Next change requires 0.001 SUI payment
                </div>
              )}
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
                transition: "border-color 0.3s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#00ffff")}
              onBlur={(e) => (e.target.style.borderColor = "#ff00ff")}
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
              transition: "background-color 0.3s, border-color 0.3s",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#00ffff";
              e.target.style.borderColor = "#00ffff";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#ff00ff";
              e.target.style.borderColor = "#ff00ff";
            }}
          >
            {remainingFreeChanges > 0 ? "Update Name (Free)" : "Update Name (0.001 SUI)"}
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
              maxWidth: "400px",
              margin: "10px auto",
              animation: "alertColorShift 10s infinite",
            }}
          >
            <style>{`
              @keyframes alertColorShift {
                0% { border-color: #ff00ff; }
                33% { border-color: #00ffff; }
                66% { border-color: #ff00ff; }
                100% { border-color: #ff00ff; }
              }
            `}</style>
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
              maxWidth: "400px",
              margin: "10px auto",
              animation: "alertColorShift 10s infinite",
            }}
          >
            {error}
          </Alert>
        )}
      </div>

      <Modal
        show={showSubscriptionModal}
        onHide={() => setShowSubscriptionModal(false)}
        centered
        style={{ background: "rgba(0, 0, 0, 0.8)" }}
      >
        <Modal.Header
          closeButton
          style={{
            background: "#330066",
            borderBottom: "2px solid #ff00ff",
            color: "#00ffff",
            textShadow: "0 0 5px #ff00ff",
            animation: "modalHeaderShift 10s infinite",
          }}
        >
          <style>{`
            @keyframes modalHeaderShift {
              0% { border-color: #ff00ff; }
              33% { border-color: #00ffff; }
              66% { border-color: #ff00ff; }
              100% { border-color: #ff00ff; }
            }
          `}</style>
          <Modal.Title>Subscribe to Membership</Modal.Title>
        </Modal.Header>
        <Modal.Body
          style={{
            background: "#1a0033",
            color: "#00ffff",
            textShadow: "0 0 3px #ff00ff",
            padding: "25px", // Increased padding for more space
            maxWidth: "500px", // Enlarged modal width
            margin: "0 auto",
            animation: "modalBodyShift 10s infinite",
          }}
        >
          <style>{`
            @keyframes modalBodyShift {
              0% { background: #1a0033; }
              33% { background: #330066; }
              66% { background: #440088; }
              100% { background: #1a0033; }
            }
          `}</style>
          <p>
            Become a member by sending $10 worth of SUI (approx. 0.5 SUI) to{" "}
            <strong
              style={{
                color: "#ffd700", // Gold color for the address
                fontSize: "14px", // Reduced font size to fit
                wordBreak: "break-all", // Ensures the address breaks properly
              }}
            >
              <br />
              0xd1b0ff621a6803c8f0cd8051359ce312ece62b485e010e32b58a99d5ec13201c
            </strong>
            <br />
            <br />
            Minimum amount required is 0.5 SUI.
          </p>
          <Button
            variant="success"
            onClick={handleSubscribe}
            style={{
              backgroundColor: "#ff00ff",
              borderColor: "#ff00ff",
              textShadow: "0 0 5px #00ffff",
              marginTop: "10px",
              transition: "background-color 0.3s, border-color 0.3s",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#00ffff";
              e.target.style.borderColor = "#00ffff";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#ff00ff";
              e.target.style.borderColor = "#ff00ff";
            }}
          >
            Pay Subscription (0.5 SUI)
          </Button>
          <Form.Group controlId="donationAmount" className="mt-3">
            <Form.Label>Optional Donation (SUI)</Form.Label>
            <Form.Control
              type="number"
              placeholder="Enter donation amount"
              value={donationAmount}
              onChange={(e) => setDonationAmount(e.target.value)}
              style={{
                backgroundColor: "#1a0033",
                color: "#00ffff",
                border: "1px dashed #ff00ff",
                borderRadius: "5px",
                padding: "10px",
                transition: "border-color 0.3s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#00ffff")}
              onBlur={(e) => (e.target.style.borderColor = "#ff00ff")}
            />
          </Form.Group>
          <Button
            variant="warning"
            onClick={() => {
              if (donationAmount && parseFloat(donationAmount) > 0)
                handleSubscribe();
            }}
            style={{
              backgroundColor: "#ff9900",
              borderColor: "#ff9900",
              textShadow: "0 0 5px #fff",
              marginTop: "10px",
              transition: "background-color 0.3s, border-color 0.3s",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#ffcc00";
              e.target.style.borderColor = "#ffcc00";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#ff9900";
              e.target.style.borderColor = "#ff9900";
            }}
            disabled={!donationAmount || parseFloat(donationAmount) <= 0}
          >
            Donate
          </Button>
          {subscriptionStatus && (
            <Alert
              variant={
                subscriptionStatus.includes("successful") ? "success" : "danger"
              }
              className="mt-3"
              style={{
                backgroundColor: "#330066",
                border: "1px solid #ff00ff",
                color: subscriptionStatus.includes("successful")
                  ? "#00ffff"
                  : "#ff0000",
                textShadow: "0 0 3px #ff00ff",
                animation: "alertColorShift 10s infinite",
              }}
            >
              {subscriptionStatus}
            </Alert>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default Settings;
