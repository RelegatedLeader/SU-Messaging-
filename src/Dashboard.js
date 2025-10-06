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
  const [mobileView, setMobileView] = useState("start"); // "start" or "chats" for mobile
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
        maxWidth: "1200px", // Back to original width
        maxHeight: "80vh", // Back to original height
        height: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "8px", // Back to original gap
        background: "linear-gradient(135deg, #1a0033, #440088)",
        border: `3px solid ${menuColor}`, // Back to original border
        borderRadius: "10px", // Back to original radius
        boxShadow: "0 0 18px rgba(0, 255, 255, 0.6)", // Back to original shadow
        fontFamily: "Orbitron, sans-serif",
        color: "#00ffff",
        padding: "10px", // Back to original padding
        overflow: "auto",
      }}
    >
      <h2
        className="text-center"
        style={{
          textShadow: "0 0 15px #00ffff", // Smaller shadow
          marginBottom: "8px", // Reduced margin
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px", // Reduced gap
          fontSize: "20px", // Smaller font
        }}
      >
        Dashboard
      </h2>
      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "space-between",
          minHeight: "400px",
          flexDirection: window.innerWidth < 768 ? "column" : "row", // Stack on mobile
        }}
      >
        {/* Mobile Toggle Buttons */}
        {window.innerWidth < 768 && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "12px",
              justifyContent: "center",
            }}
          >
            <Button
              onClick={() => setMobileView("start")}
              style={{
                backgroundColor: mobileView === "start" ? menuColor : "#330066",
                border: `2px solid ${menuColor}`,
                color: "#00ffff",
                textShadow: "0 0 6px #00ffff",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                flex: "1",
                minHeight: "44px", // Touch-friendly
              }}
            >
              📝 Start Chat
            </Button>
            <Button
              onClick={() => setMobileView("chats")}
              style={{
                backgroundColor: mobileView === "chats" ? menuColor : "#330066",
                border: `2px solid ${menuColor}`,
                color: "#00ffff",
                textShadow: "0 0 6px #00ffff",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                flex: "1",
                minHeight: "44px", // Touch-friendly
              }}
            >
              💬 Recent Chats
            </Button>
          </div>
        )}

        {/* Start Chat Form - Show on desktop or when selected on mobile */}
        {(window.innerWidth >= 768 || mobileView === "start") && (
          <Form
            onSubmit={handleStartChat}
            style={{
              flex: window.innerWidth < 768 ? "none" : "1 1 300px",
              width: window.innerWidth < 768 ? "100%" : "auto",
              minWidth: window.innerWidth < 768 ? "auto" : "250px",
              border: `2px solid ${menuColor}`,
              padding: window.innerWidth < 768 ? "16px" : "8px",
              borderRadius: window.innerWidth < 768 ? "8px" : "6px",
              background: "linear-gradient(135deg, #1a0033, #330066)",
              boxShadow: window.innerWidth < 768 ? "0 0 15px rgba(0, 255, 255, 0.4)" : "0 0 12px rgba(0, 255, 255, 0.4)",
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
                borderRadius: "4px", // Smaller radius
                padding: "6px", // Reduced padding
                fontSize: "12px", // Smaller font
                textShadow: "0 0 2px #ccffcc", // Smaller shadow
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
              textShadow: "0 0 5px #00ffff", // Smaller shadow
              padding: "6px 12px", // Reduced padding
              fontSize: "12px", // Smaller font
              transition: "background-color 0.4s",
              width: "100%",
              borderRadius: "4px", // Smaller radius
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#00ffff")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = menuColor)}
          >
            Start Chat
          </Button>
        </Form>
        )}

        {/* Recent Chats Section - Show on desktop or when selected on mobile */}
        {(window.innerWidth >= 768 || mobileView === "chats") && (
          <div
            style={{
              flex: window.innerWidth < 768 ? "none" : "2 1 400px",
              width: window.innerWidth < 768 ? "100%" : "auto",
              minWidth: window.innerWidth < 768 ? "auto" : "300px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
          <InputGroup
            style={{
              height: "32px", // Reduced height
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
                borderRadius: "4px", // Smaller radius
                padding: "6px", // Reduced padding
                fontSize: "12px", // Smaller font
                textShadow: "0 0 2px #ccffcc", // Smaller shadow
                transition: "border-color 0.4s",
                height: "32px", // Reduced height
              }}
            />
          </InputGroup>
          <div
            style={{
              overflow: "auto", // Keep scroll for overflow
            }}
          >
            <h4 style={{ textShadow: "0 0 10px #00ffff", marginBottom: "4px", fontSize: "14px" }}>
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
                  borderRadius: "4px", // Smaller radius
                  boxShadow: "0 0 12px rgba(0, 255, 255, 0.4)", // Smaller shadow
                }}
              >
                {filteredChats.map((chat, index) => (
                  <ListGroup.Item
                    key={index}
                    style={{
                      backgroundColor: "#1a0033",
                      color: "#00ffff",
                      position: "relative",
                      padding: "6px", // Reduced padding
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
      )}
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
