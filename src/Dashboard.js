import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Form,
  Button,
  Alert,
  ListGroup,
  InputGroup,
  Badge,
} from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import { useWalletKit } from "@mysten/wallet-kit";
import { SuiClient } from "@mysten/sui.js/client";

function Dashboard() {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recentChats, setRecentChats] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [menuColor, setMenuColor] = useState("#ff00ff"); // Sync with App.js default
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
          const isActive = lastEvent
            ? Date.now() - Number(lastEvent.parsedJson.timestamp) < 86400000
            : false; // Active if within 24 hours

          return {
            address,
            displayName,
            lastMessage,
            hasNewMessages,
            isActive,
          };
        })
      );

      setRecentChats(chatData);
    } catch (err) {
      setError("Failed to fetch recent chats: " + err.message);
      console.error(err);
    }
  }, [isConnected, currentAccount, client]); // Added client

  useEffect(() => {
    fetchRecentChats();

    // Dynamic color animation synced with App.js
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

  const markAllRead = () => {
    setRecentChats((prevChats) =>
      prevChats.map((chat) => ({ ...chat, hasNewMessages: false }))
    );
  };

  const refreshChats = () => {
    fetchRecentChats();
  };

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
        <Badge
          bg="danger"
          style={{
            backgroundColor: menuColor,
            color: "#00ffff",
            textShadow: "0 0 5px #00ffff",
            padding: "5px 10px",
            borderRadius: "10px",
            transition: "background-color 0.4s",
          }}
        >
          {recentChats.filter((chat) => chat.hasNewMessages).length}
        </Badge>
        <Badge
          bg="secondary"
          style={{
            backgroundColor: "#330066",
            color: "#00ffff",
            textShadow: "0 0 5px #00ffff",
            padding: "5px 10px",
            borderRadius: "10px",
          }}
        >
          {recentChats.length} Chats
        </Badge>
      </h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "15px",
          justifyContent: "space-between",
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
                backgroundColor: "#1a0033",
                color: "#ccffcc",
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
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
            }}
          >
            <InputGroup style={{ flex: "1" }}>
              <Form.Control
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  backgroundColor: "#1a0033",
                  color: "#00ffff",
                  border: `1px dashed ${menuColor}`,
                  borderRadius: "5px",
                  padding: "8px",
                  fontSize: "14px",
                  textShadow: "0 0 3px #ccffcc",
                  transition: "border-color 0.4s",
                }}
              />
            </InputGroup>
            <Button
              variant="primary"
              onClick={refreshChats}
              style={{
                backgroundColor: menuColor,
                borderColor: menuColor,
                textShadow: "0 0 6px #00ffff",
                padding: "8px 15px",
                fontSize: "14px",
                transition: "background-color 0.4s",
                borderRadius: "5px",
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
            >
              Refresh Chats
            </Button>
            <Button
              variant="primary"
              onClick={markAllRead}
              style={{
                backgroundColor: menuColor,
                borderColor: menuColor,
                textShadow: "0 0 6px #00ffff",
                padding: "8px 15px",
                fontSize: "14px",
                transition: "background-color 0.4s",
                borderRadius: "5px",
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
            >
              Clear Notifications
            </Button>
          </div>
          <div style={{ flex: "1", overflow: "auto" }}>
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
