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
        "0x3f455d572c2b923918a0623bef2e075b9870dc650c2f9e164aa2ea5693506d80";

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
        console.log("Events response for recent chats:", response.data);
        allEvents = [...allEvents, ...response.data];
        cursor = response.nextCursor;
        hasNextPage = response.hasNextPage;
      } while (hasNextPage);

      console.log("Fetched events for recent chats:", allEvents);

      // Extract unique recipients and fetch their display names with last message
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

      const recipientList = Array.from(recipients);
      const chatData = await Promise.all(
        recipientList.map(async (address) => {
          const objects = await client.getOwnedObjects({
            owner: address,
            options: { showType: true, showContent: true },
          });
          const userObject = objects.data.find((obj) =>
            obj.data.type.includes(`${packageId}::su_messaging::User`)
          );
          const displayName = userObject?.data.content.fields.display_name
            ? new TextDecoder().decode(
                new Uint8Array(userObject.data.content.fields.display_name)
              )
            : address.slice(0, 6) + "...";

          // Get the last message (sent or received) with debugging
          const relevantEvents = allEvents.filter(
            (event) =>
              event.parsedJson.sender === address ||
              event.parsedJson.recipient === address
          );
          const lastEvent = relevantEvents.sort(
            (a, b) => b.timestamp - a.timestamp
          )[0];
          const lastMessage = lastEvent
            ? new TextDecoder().decode(
                new Uint8Array(lastEvent.parsedJson.encrypted_content)
              )
            : "No messages yet";
          console.log(`Last message for ${address}: ${lastMessage}`); // Debug log

          // Simulate new messages only from the other user (unread)
          const hasNewMessages = allEvents.some(
            (event) =>
              event.parsedJson.sender === address && // From other user
              event.parsedJson.recipient === senderAddress && // To current user
              !event.parsedJson.is_read // Unread
          );

          return { address, displayName, lastMessage, hasNewMessages };
        })
      );

      setRecentChats(chatData);
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

    // Navigate to the chat page with the recipient address, removing new message indicator
    navigate(`/chat/${recipientAddress}`, {
      state: { clearNewMessages: true },
    });
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
                backgroundColor: "#ffffff", // White background
                color: "#000000", // Black text for visibility
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
            {recentChats.map((chat, index) => (
              <ListGroup.Item
                key={index}
                style={{
                  backgroundColor: "var(--accent-dark)",
                  color: "var(--text-primary)",
                  position: "relative",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Link
                  to={`/chat/${chat.address}`}
                  onClick={() => {
                    if (chat.hasNewMessages) {
                      setRecentChats((prevChats) =>
                        prevChats.map((c) =>
                          c.address === chat.address
                            ? { ...c, hasNewMessages: false }
                            : c
                        )
                      );
                    }
                  }}
                  style={{
                    color: "#ffffff", // White text
                    textDecoration: "none",
                    fontWeight: "bold", // Bold text
                    marginBottom: "5px",
                  }}
                >
                  {chat.displayName}
                </Link>
                <div
                  style={{
                    color: "#ffffff", // White text
                    fontWeight: "normal",
                    padding: "5px",
                    backgroundColor: "#333", // Dark background for contrast
                    borderRadius: "5px",
                    maxWidth: "80%",
                    wordWrap: "break-word",
                    border: "1px solid #89CFF0", // Add border for visibility
                  }}
                >
                  {chat.lastMessage || "No message content available"}{" "}
                  {/* Fallback text */}
                </div>
                {chat.hasNewMessages && (
                  <span
                    style={{
                      position: "absolute",
                      top: "5px",
                      right: "5px",
                      width: "10px",
                      height: "10px",
                      backgroundColor: "#89CFF0", // Baby blue
                      borderRadius: "50%",
                    }}
                  />
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </div>
    </Container>
  );
}

export default Dashboard;
