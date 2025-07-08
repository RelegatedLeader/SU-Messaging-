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
  const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });

  const fetchRecentChats = useCallback(async () => {
    if (!isConnected || !currentAccount) return;

    try {
      const senderAddress = currentAccount.address;
      const packageId =
        "0x3c7d131d38c117cbc75e3a8349ea3c841776ad6c6168e9590ba1fc4478018799";

      let allEvents = [];
      let cursor = null;
      let hasNextPage = true;

      do {
        const response = await client.queryEvents({
          query: {
            MoveEventType: `${packageId}::message::MessageCreated`,
          },
          limit: 50,
          cursor,
          order: "ascending",
        });
        console.log("Events response for recent chats:", response.data);
        allEvents = [...allEvents, ...response.data];
        cursor = response.nextCursor;
        hasNextPage = response.hasNextPage;
      } while (hasNextPage);

      console.log("Fetched events for recent chats:", allEvents);

      const recipients = new Set();
      for (const event of allEvents) {
        const { sender, recipient } = event.parsedJson || {};
        if (!sender || !recipient) continue;
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
            obj.data.type.includes(
              "0x3f455d572c2b923918a0623bef2e075b9870dc650c2f9e164aa2ea5693506d80::su_messaging::User"
            )
          );
          const displayName = userObject?.data.content.fields.display_name
            ? new TextDecoder().decode(
                new Uint8Array(userObject.data.content.fields.display_name)
              )
            : address.slice(0, 6) + "...";

          const relevantEvents = allEvents.filter(
            (event) =>
              event.parsedJson.sender === address ||
              event.parsedJson.recipient === address
          );
          const lastEvent = relevantEvents.sort(
            (a, b) =>
              Number(b.parsedJson.timestamp) - Number(a.parsedJson.timestamp)
          )[0];
          const lastMessage = lastEvent
            ? new TextDecoder().decode(
                new Uint8Array(lastEvent.parsedJson.content)
              )
            : "No messages yet";
          console.log(
            `Last message for ${address}: ${lastMessage}, Timestamp: ${lastEvent?.parsedJson.timestamp}`
          );

          const hasNewMessages = allEvents.some(
            (event) =>
              event.parsedJson.sender === address &&
              event.parsedJson.recipient === senderAddress &&
              !event.parsedJson.is_read
          );

          return { address, displayName, lastMessage, hasNewMessages };
        })
      );

      setRecentChats(chatData);
    } catch (err) {
      setError("Failed to fetch recent chats: " + err.message);
      console.error(err);
    }
  }, [isConnected, currentAccount]);

  useEffect(() => {
    fetchRecentChats();
  }, [fetchRecentChats]);

  const handleStartChat = (e) => {
    e.preventDefault();
    setError(null);

    if (!recipientAddress.match(/^0x[a-fA-F0-9]{64}$/)) {
      setError(
        "Please enter a valid SUI address (64 characters starting with 0x)."
      );
      return;
    }

    navigate(`/chat/${recipientAddress}`, {
      state: { clearNewMessages: true },
    });
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
        Dashboard
      </h2>
      <div className="mt-4">
        <Form
          onSubmit={handleStartChat}
          className="mx-auto"
          style={{
            maxWidth: "600px",
            border: "2px solid #ff00ff",
            padding: "15px",
            borderRadius: "8px",
          }}
        >
          <Form.Group controlId="recipientAddress">
            <Form.Label style={{ textShadow: "0 0 5px #ff00ff" }}>
              Start a Chat
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter recipient's SUI address (e.g., 0x...)"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
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
            Start Chat
          </Button>
        </Form>
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
      <div className="mt-4">
        <h4 style={{ textShadow: "0 0 10px #00ffff" }}>Recent Chats</h4>
        {recentChats.length === 0 ? (
          <p style={{ color: "#00ffff" }}>No recent chats yet.</p>
        ) : (
          <ListGroup
            style={{
              maxHeight: "calc(100vh - 300px)",
              overflowY: "auto",
              background: "rgba(0, 0, 0, 0.5)",
              border: "2px solid #ff00ff",
              borderRadius: "5px",
            }}
          >
            {recentChats.map((chat, index) => (
              <ListGroup.Item
                key={index}
                style={{
                  backgroundColor: "#1a0033",
                  color: "#00ffff",
                  position: "relative",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  borderBottom: "1px dashed #ff00ff",
                  transition: "background-color 0.3s",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = "#00ccff")
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor = "#1a0033")
                }
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
                    color: "#00ffff",
                    textDecoration: "none",
                    fontWeight: "bold",
                    marginBottom: "5px",
                    textShadow: "0 0 5px #ff00ff",
                  }}
                >
                  {chat.displayName}
                </Link>
                <div
                  style={{
                    color: "#00ffff",
                    fontWeight: "normal",
                    padding: "5px",
                    backgroundColor: "#330066",
                    borderRadius: "5px",
                    maxWidth: "80%",
                    wordWrap: "break-word",
                    border: "1px dashed #ff00ff",
                    boxShadow: "0 0 10px rgba(0, 255, 255, 0.5)",
                  }}
                >
                  {chat.lastMessage || "No message content available"}
                </div>
                {chat.hasNewMessages && (
                  <span
                    style={{
                      position: "absolute",
                      top: "5px",
                      right: "5px",
                      width: "10px",
                      height: "10px",
                      backgroundColor: "#ff00ff",
                      borderRadius: "50%",
                      boxShadow: "0 0 5px #00ffff",
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
