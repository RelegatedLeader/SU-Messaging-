import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Container,
  Form,
  Button,
  Alert,
  ListGroup,
  InputGroup,
} from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { SuiClient } from "@mysten/sui/client";
import Long from "long"; // Added for timestamp handling

function Dashboard() {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recentChats, setRecentChats] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [menuColor, setMenuColor] = useState("#ff00ff"); // Sync with App.js default
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const isConnected = !!currentAccount;
  const client = useMemo(
    () => new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" }),
    []
  );

  const fetchRecentChats = useCallback(async () => {
    if (!isConnected || !currentAccount) return;

    try {
      const senderAddress = currentAccount.address;
      const packageId =
        "0x3c7d131d38c117cbc75e3a8349ea3c841776ad6c6168e9590ba1fc4478018799";

      let allEvents = [];

      // Single fetch with sufficient limit to avoid excessive looping
      const response = await client.queryEvents({
        query: { MoveEventType: `${packageId}::su_messaging::MessageCreated` },
        limit: 100, // Adequate limit to cover recent chats
        order: "ascending",
      });
      allEvents = [...allEvents, ...response.data];

      const recipients = new Set();
      for (const event of allEvents) {
        const { sender, recipient } = event.parsedJson || {};
        if (!sender || !recipient) continue;
        if (
          (sender === senderAddress && recipient !== senderAddress) ||
          (recipient === senderAddress && sender !== senderAddress)
        ) {
          if (sender === senderAddress) recipients.add(recipient);
          else recipients.add(sender);
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

          let lastMessage = "No messages yet";
          let hasNewMessages = false;

          const relevantEvents = allEvents.filter(
            (event) =>
              (event.parsedJson.sender === address &&
                event.parsedJson.recipient === senderAddress) ||
              (event.parsedJson.recipient === address &&
                event.parsedJson.sender === senderAddress)
          );
          if (relevantEvents.length > 0) {
            const latestEvent = relevantEvents.sort(
              (a, b) =>
                Number(b.parsedJson.timestamp) - Number(a.parsedJson.timestamp)
            )[0];
            const [senderObjects, recipientObjects] = await Promise.all([
              client.getOwnedObjects({
                owner: senderAddress,
                filter: {
                  MatchAll: [{ StructType: `${packageId}::su_messaging::Message` }],
                },
                options: { showContent: true, showType: true },
              }),
              client.getOwnedObjects({
                owner: address,
                filter: {
                  MatchAll: [{ StructType: `${packageId}::su_messaging::Message` }],
                },
                options: { showContent: true, showType: true },
              }),
            ]);

            const allObjects = [
              ...senderObjects.data,
              ...recipientObjects.data,
            ];
            const latestTimestamp = latestEvent.parsedJson.timestamp
              ? Long.fromValue(latestEvent.parsedJson.timestamp).toNumber()
              : 0; // Fallback if timestamp is invalid
            for (const obj of allObjects) {
              const fields = obj.data?.content?.fields;
              if (
                fields &&
                ((fields.sender === senderAddress &&
                  fields.recipient === address) ||
                  (fields.sender === address &&
                    fields.recipient === senderAddress))
              ) {
                const timestampMs = fields.timestamp
                  ? Long.fromValue(fields.timestamp).toNumber()
                  : 0; // Fallback for invalid timestamp
                if (timestampMs >= latestTimestamp) {
                  lastMessage = new TextDecoder().decode(
                    new Uint8Array(fields.content)
                  );
                  hasNewMessages = !fields.is_read; // Sync with Chat.js
                }
              }
            }
          }

          return {
            address,
            displayName,
            lastMessage,
            hasNewMessages,
          };
        })
      );

      setRecentChats(chatData);
    } catch (err) {
      setError("Failed to fetch recent chats: " + err.message);
      console.error(err);
    }
  }, [isConnected, currentAccount, client]);

  useEffect(() => {
    fetchRecentChats();

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

  const filteredChats = recentChats.filter(
    (chat) =>
      chat.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container
      className="mt-3"
      style={{
        maxWidth: "1200px",
        maxHeight: "90vh",
        height: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        background: "linear-gradient(135deg, #1a0033, #440088)",
        border: `5px solid ${menuColor}`,
        borderRadius: "15px",
        boxShadow: "0 0 25px rgba(0, 255, 255, 0.8)",
        fontFamily: "Orbitron, sans-serif",
        color: "#00ffff",
        padding: "15px",
        overflow: "auto",
      }}
    >
      <h2
        className="text-center"
        style={{
          textShadow: "0 0 18px #00ffff",
          marginBottom: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
        }}
      >
        Dashboard
      </h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "15px",
          justifyContent: "space-between",
          minHeight: "500px",
        }}
      >
        <Form
          onSubmit={handleStartChat}
          style={{
            flex: "1 1 400px",
            minWidth: "300px",
            border: `2px solid ${menuColor}`,
            padding: "10px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #1a0033, #330066)",
            boxShadow: "0 0 15px rgba(0, 255, 255, 0.5)",
          }}
        >
          <Form.Group controlId="recipientAddress">
            <Form.Label style={{ textShadow: "0 0 6px #ff00ff" }}>
              Start a Chat
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter recipient's SUI address (e.g., 0x...)"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              required
              style={{
                backgroundColor: "white",
                color: "black",
                border: `1px dashed ${menuColor}`,
                borderRadius: "5px",
                padding: "8px",
                fontSize: "14px",
                textShadow: "0 0 3px #ccffcc",
                transition: "border-color 0.4s",
              }}
            />
          </Form.Group>
          <Button
            variant="primary"
            type="submit"
            className="mt-2"
            style={{
              backgroundColor: menuColor,
              borderColor: menuColor,
              textShadow: "0 0 6px #00ffff",
              padding: "8px 15px",
              fontSize: "14px",
              transition: "background-color 0.4s",
              width: "100%",
              borderRadius: "5px",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
          >
            Start Chat
          </Button>
        </Form>
        <div
          style={{
            flex: "2 1 600px",
            minWidth: "300px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <InputGroup
            style={{
              height: "38px", // Matches typical Bootstrap input height
            }}
          >
            <Form.Control
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                backgroundColor: "white",
                color: "black",
                border: `1px dashed ${menuColor}`,
                borderRadius: "5px",
                padding: "8px",
                fontSize: "14px",
                textShadow: "0 0 3px #ccffcc",
                transition: "border-color 0.4s",
                height: "38px", // Matches typical Bootstrap input height
              }}
            />
          </InputGroup>
          <div
            style={{
              overflow: "auto", // Keep scroll for overflow
            }}
          >
            <h4 style={{ textShadow: "0 0 12px #00ffff", marginBottom: "5px" }}>
              Recent Chats
            </h4>
            {filteredChats.length === 0 ? (
              <p style={{ color: "#00ffff" }}>No recent chats yet.</p>
            ) : (
              <ListGroup
                style={{
                  background: "rgba(0, 0, 0, 0.5)",
                  border: `2px solid ${menuColor}`,
                  borderRadius: "5px",
                  boxShadow: "0 0 15px rgba(0, 255, 255, 0.5)",
                }}
              >
                {filteredChats.map((chat, index) => (
                  <ListGroup.Item
                    key={index}
                    style={{
                      backgroundColor: "#1a0033",
                      color: "#00ffff",
                      position: "relative",
                      padding: "8px",
                      display: "flex",
                      flexDirection: "column",
                      borderBottom: `1px dashed ${menuColor}`,
                      transition: "background-color 0.3s",
                    }}
                    onMouseEnter={(e) =>
                      (e.target.style.backgroundColor = "#00ccff")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.backgroundColor = "#1a0033")
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          backgroundColor: chat.isActive
                            ? "#00ff00"
                            : "#808080",
                          borderRadius: "50%",
                          border: `1px solid ${menuColor}`,
                        }}
                      />
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
                          flex: "1",
                        }}
                      >
                        {chat.displayName}
                      </Link>
                    </div>
                    <div
                      style={{
                        color: "#00ffff",
                        fontWeight: "normal",
                        padding: "5px",
                        backgroundColor: "#330066",
                        borderRadius: "5px",
                        maxWidth: "80%",
                        wordWrap: "break-word",
                        border: `1px dashed ${menuColor}`,
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
                          backgroundColor: menuColor,
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
        </div>
      </div>
      {error && (
        <Alert
          variant="danger"
          className="mt-2"
          style={{
            backgroundColor: "#330066",
            border: `1px solid ${menuColor}`,
            color: "#ff0000",
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            maxWidth: "600px",
            boxShadow: "0 0 15px rgba(255, 0, 0, 0.5)",
          }}
        >
          {error}
        </Alert>
      )}
    </Container>
  );
}

export default Dashboard;
