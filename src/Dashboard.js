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
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const isConnected = !!currentAccount;
  const client = useMemo(
    () => new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" }),
    []
  );

  const fetchRecentChats = useCallback(async () => {
    if (!isConnected || !currentAccount) return;

    setIsLoadingChats(true);
    try {
      const senderAddress = currentAccount.address;
      const packageId =
        "0x2aaad5d1ce7482b5850dd11642358bf23cb0e6432b12a581eb77d212dca54045";

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
              "0x2aaad5d1ce7482b5850dd11642358bf23cb0e6432b12a581eb77d212dca54045::su_messaging::User"
            )
          );
          const displayName = userObject?.data.content.fields.display_name
            ? new TextDecoder().decode(
                new Uint8Array(userObject.data.content.fields.display_name)
              )
            : address.slice(0, 6) + "...";

          let lastMessage = "No messages yet";
          let lastMessageTime = 0;

          // Find the most recent message in this conversation from the events
          for (const event of allEvents) {
            const eventData = event.parsedJson || {};
            const { sender, recipient, message_id, timestamp } = eventData;
            
            // Check if this event is part of our conversation
            const isOurConversation = 
              (sender === senderAddress && recipient === address) ||
              (sender === address && recipient === senderAddress);
            
            if (isOurConversation && timestamp && message_id) {
              const messageTime = Long.fromValue(timestamp).toNumber();
              if (messageTime > lastMessageTime) {
                try {
                  // Fetch the message object to get the content
                  const messageObject = await client.getObject({
                    id: message_id,
                    options: { showContent: true },
                  });
                  
                  if (messageObject.data?.content?.fields?.encrypted_content) {
                    lastMessage = new TextDecoder().decode(
                      new Uint8Array(messageObject.data.content.fields.encrypted_content)
                    );
                  } else {
                    lastMessage = "No content available";
                  }
                } catch (error) {
                  console.error('Failed to fetch message content:', error);
                  lastMessage = "Error loading message";
                }
                lastMessageTime = messageTime;
              }
            }
          }

          return {
            address,
            displayName,
            lastMessage,
          };
        })
      );

      setRecentChats(chatData);
    } catch (err) {
      setError("Failed to fetch recent chats: " + err.message);
      console.error(err);
    } finally {
      setIsLoadingChats(false);
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
        maxWidth: "95vw", // Responsive width for mobile
        width: "100%", // Full width on small screens
        maxHeight: "85vh", // Better mobile height
        height: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "12px", // Slightly larger gap for touch
        background: "linear-gradient(135deg, #1a0033, #440088)",
        border: `3px solid ${menuColor}`,
        borderRadius: "12px", // Slightly larger radius for mobile
        boxShadow: "0 0 20px rgba(0, 255, 255, 0.6)", // Adjusted shadow
        fontFamily: "Orbitron, sans-serif",
        color: "#00ffff",
        padding: "16px", // Increased padding for mobile
        overflow: "auto",
        margin: "0 auto", // Center on page
      }}
    >
      <h2
        className="text-center"
        style={{
          textShadow: "0 0 15px #00ffff",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          fontSize: "clamp(18px, 4vw, 24px)", // Responsive font size
        }}
      >
        Dashboard
      </h2>
      <div
        style={{
          display: "flex",
          flexDirection: "column", // Stack vertically on mobile
          gap: "16px",
          minHeight: "500px",
        }}
      >
        <Form
          onSubmit={handleStartChat}
          style={{
            width: "100%", // Full width on mobile
            border: `2px solid ${menuColor}`,
            padding: "16px", // Increased padding
            borderRadius: "8px",
            background: "linear-gradient(135deg, #1a0033, #330066)",
            boxShadow: "0 0 15px rgba(0, 255, 255, 0.4)",
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
                borderRadius: "6px",
                padding: "12px", // Larger padding for touch
                fontSize: "16px", // Prevents zoom on iOS
                textShadow: "0 0 2px #ccffcc",
                transition: "border-color 0.4s",
                minHeight: "48px", // Touch-friendly height
              }}
            />
          </Form.Group>
          <Button
            variant="primary"
            type="submit"
            className="mt-3"
            style={{
              backgroundColor: menuColor,
              borderColor: menuColor,
              textShadow: "0 0 5px #00ffff",
              padding: "12px 20px", // Larger padding for touch
              fontSize: "16px", // Prevents zoom on iOS
              transition: "background-color 0.4s",
              width: "100%",
              borderRadius: "8px",
              minHeight: "48px", // Touch-friendly height
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
          >
            Start Chat
          </Button>
        </Form>
        <div
          style={{
            width: "100%", // Full width on mobile
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <InputGroup
            style={{
              height: "48px", // Touch-friendly height
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
                borderRadius: "6px",
                padding: "12px", // Larger padding
                fontSize: "16px", // Prevents zoom on iOS
                textShadow: "0 0 2px #ccffcc",
                transition: "border-color 0.4s",
                height: "48px", // Touch-friendly height
              }}
            />
          </InputGroup>
          <div
            style={{
              overflow: "auto", // Keep scroll for overflow
            }}
          >
            <h4 style={{ textShadow: "0 0 10px #00ffff", marginBottom: "8px", fontSize: "18px" }}>
              Recent Chats
            </h4>
            {isLoadingChats ? (
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.5)",
                  border: `2px solid ${menuColor}`,
                  borderRadius: "4px",
                  padding: "20px",
                  textAlign: "center",
                  boxShadow: "0 0 12px rgba(0, 255, 255, 0.4)",
                }}
              >
                <div
                  style={{
                    fontSize: "16px",
                    color: "#00ffff",
                    textShadow: "0 0 8px #00ffff",
                    marginBottom: "15px",
                    fontWeight: "bold",
                  }}
                >
                  🔄 ITERATING THROUGH THE BLOCKCHAIN
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      backgroundColor: menuColor,
                      borderRadius: "50%",
                      animation: "blockchainPulse 1.5s ease-in-out infinite",
                    }}
                  />
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      backgroundColor: menuColor,
                      borderRadius: "50%",
                      animation: "blockchainPulse 1.5s ease-in-out infinite 0.2s",
                    }}
                  />
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      backgroundColor: menuColor,
                      borderRadius: "50%",
                      animation: "blockchainPulse 1.5s ease-in-out infinite 0.4s",
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: "15px",
                    fontSize: "12px",
                    color: "#00ffff",
                    opacity: 0.8,
                  }}
                >
                  Scanning blockchain for your messages...
                </div>
                <style>{`
                  @keyframes blockchainPulse {
                    0%, 100% {
                      opacity: 0.3;
                      transform: scale(1);
                    }
                    50% {
                      opacity: 1;
                      transform: scale(1.2);
                      box-shadow: 0 0 10px ${menuColor};
                    }
                  }
                `}</style>
              </div>
            ) : filteredChats.length === 0 ? (
              <p style={{ color: "#00ffff" }}>No recent chats yet.</p>
            ) : (
              <ListGroup
                style={{
                  background: "rgba(0, 0, 0, 0.5)",
                  border: `2px solid ${menuColor}`,
                  borderRadius: "8px",
                  boxShadow: "0 0 15px rgba(0, 255, 255, 0.4)",
                }}
              >
                {filteredChats.map((chat, index) => (
                  <ListGroup.Item
                    key={index}
                    style={{
                      backgroundColor: "#1a0033",
                      color: "#00ffff",
                      position: "relative",
                      padding: "12px", // Larger padding for touch
                      display: "flex",
                      flexDirection: "column",
                      borderBottom: `1px dashed ${menuColor}`,
                      transition: "background-color 0.3s",
                      minHeight: "60px", // Touch-friendly height
                      cursor: "pointer",
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
                        gap: "8px", // Reduced gap
                      }}
                    >
                      <span
                        style={{
                          width: "8px", // Smaller indicator
                          height: "8px", // Smaller indicator
                          backgroundColor: "#00ff00", // Always green for active chats
                          borderRadius: "50%",
                          border: `1px solid ${menuColor}`,
                        }}
                      />
                      <Link
                        to={`/chat/${chat.address}`}
                        style={{
                          color: "#00ffff",
                          textDecoration: "none",
                          fontWeight: "bold",
                          marginBottom: "3px", // Reduced margin
                          textShadow: "0 0 4px #ff00ff", // Smaller shadow
                          flex: "1",
                          fontSize: "12px", // Smaller font
                        }}
                      >
                        {chat.displayName}
                      </Link>
                    </div>
                    <div
                      style={{
                        color: "#00ffff",
                        fontWeight: "normal",
                        padding: "8px", // Larger padding
                        backgroundColor: "#330066",
                        borderRadius: "6px", // Larger radius
                        maxWidth: "85%",
                        wordWrap: "break-word",
                        border: `1px dashed ${menuColor}`,
                        boxShadow: "0 0 10px rgba(0, 255, 255, 0.4)",
                        fontSize: "14px", // Larger font for mobile
                        marginTop: "8px",
                      }}
                    >
                      {chat.lastMessage || "No message content available"}
                    </div>
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
          className="mt-3"
          style={{
            backgroundColor: "#330066",
            border: `2px solid ${menuColor}`,
            color: "#ff0000",
            width: "100%",
            boxShadow: "0 0 15px rgba(255, 0, 0, 0.5)",
            fontSize: "16px", // Prevents zoom on iOS
            padding: "12px",
            borderRadius: "8px",
          }}
        >
          {error}
        </Alert>
      )}
    </Container>
  );
}

export default Dashboard;
