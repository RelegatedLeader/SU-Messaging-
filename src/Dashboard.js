import React, { useState, useEffect, useCallback } from "react";
import { Container, Form, Button, Alert, ListGroup } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import { useWalletKit } from "@mysten/wallet-kit";
import { SuiClient } from "@mysten/sui.js/client";

function Dashboard() {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recentChats, setRecentChats] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { isConnected, currentAccount } = useWalletKit();

  // Initialize SUI client for Devnet
  const client = new SuiClient({ url: "https://fullnode.devnet.sui.io:443" });

  // Memoize fetchRecentChats to prevent unnecessary re-renders
  const fetchRecentChats = useCallback(async () => {
    if (!isConnected || !currentAccount) return;

    try {
      const senderAddress = currentAccount.address;
      const packageId =
        "0x62c1db5b7060a2d7207430b62c94dcfa50aaf1d5a09fb3a39f2869c86cd6f61b";

      // Query events with pagination
      let allEvents = [];
      let cursor = null;
      let hasNextPage = true;

      do {
        const response = await client.queryEvents({
          query: {
            MoveEventType: `${packageId}::su_messaging::MessageCreated`,
          },
          limit: 50,
          cursor,
        });
        console.log("Events response for recent chats:", response);
        allEvents = [...allEvents, ...response.data];
        cursor = response.nextCursor;
        hasNextPage = response.hasNextPage;
      } while (hasNextPage);

      console.log("Fetched events for recent chats:", allEvents);

      // Extract unique recipients
      const recipients = new Set();
      for (const event of allEvents) {
        const { sender, recipient } = event.parsedJson;
        console.log(
          `Event in recent chats: sender=${sender}, recipient=${recipient}`
        );
        if (sender === senderAddress) {
          recipients.add(recipient);
        } else if (recipient === senderAddress) {
          recipients.add(sender);
        }
      }

      setRecentChats(Array.from(recipients));
    } catch (err) {
      setError("Failed to fetch recent chats: " + err.message);
      console.error(err);
    }
  }, [isConnected, currentAccount]); // Dependencies for useCallback

  // Fetch recent chats when the component mounts or when dependencies change
  useEffect(() => {
    fetchRecentChats();
  }, [fetchRecentChats]); // Only re-run if fetchRecentChats changes

  const handleStartChat = (e) => {
    e.preventDefault();
    setError(null);

    // Basic validation for SUI address (64 characters, starts with 0x)
    if (!recipientAddress.match(/^0x[a-fA-F0-9]{64}$/)) {
      setError(
        "Please enter a valid SUI address (64 characters starting with 0x)."
      );
      return;
    }

    // Navigate to the chat page with the recipient address
    navigate(`/chat/${recipientAddress}`);
  };

  return (
    <Container className="mt-5">
      <h2 className="text-center">Dashboard</h2>
      <div className="mt-4">
        <Form
          onSubmit={handleStartChat}
          className="mx-auto"
          style={{ maxWidth: "600px" }}
        >
          <Form.Group controlId="recipientAddress">
            <Form.Label>Start a Chat</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter recipient's SUI address (e.g., 0x...)"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              required
              style={{
                backgroundColor: "var(--accent-dark)",
                color: "var(--text-primary)",
                borderColor: "var(--primary-blue)",
              }}
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
            Start Chat
          </Button>
        </Form>
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </div>
      <div className="mt-4">
        <h4>Recent Chats</h4>
        {recentChats.length === 0 ? (
          <p>No recent chats yet.</p>
        ) : (
          <ListGroup>
            {recentChats.map((address, index) => (
              <ListGroup.Item
                key={index}
                style={{
                  backgroundColor: "var(--accent-dark)",
                  color: "var(--text-primary)",
                }}
              >
                <Link
                  to={`/chat/${address}`}
                  style={{
                    color: "var(--primary-blue)",
                    textDecoration: "none",
                  }}
                >
                  {address}
                </Link>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </div>
    </Container>
  );
}

export default Dashboard;
