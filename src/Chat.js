import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Container,
  Row,
  Col,
  Button,
  ListGroup,
  Form,
  Alert,
} from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import { Transaction, Inputs } from "@mysten/sui/transactions";
import { bcs } from "@mysten/bcs";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import Long from "long";

function Chat() {
  const { id: recipientAddress } = useParams();
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const isConnected = !!currentAccount;
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  
  console.log('Chat component state:', { isConnected, currentAccount: currentAccount?.address, recipientAddress });
  
  // Redirect to dashboard if not connected
  useEffect(() => {
    if (!isConnected) {
      console.log('Not connected, redirecting to dashboard');
      navigate('/');
    }
  }, [isConnected, navigate]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sendStatus, setSendStatus] = useState(false);
  const [error, setError] = useState(null);
  const [recipientName, setRecipientName] = useState(
    recipientAddress || "Stranger"
  );
  const [recentChats, setRecentChats] = useState([]);
  const chatContentRef = useRef(null);
  const packageId =
    "0x3c7d131d38c117cbc75e3a8349ea3c841776ad6c6168e9590ba1fc4478018799";

  // Check if package exists
  useEffect(() => {
    const checkPackage = async () => {
      try {
        console.log('Checking if package exists:', packageId);
        const packageInfo = await client.getObject({ id: packageId });
        console.log('Package info:', packageInfo);
      } catch (error) {
        console.error('Package not found or error:', error);
      }
    };
    if (client) checkPackage();
  }, [client]);

  // Define functions before use
  const fetchUserName = useCallback(
    async (address) => {
      try {
        const objects = await client.getOwnedObjects({
          owner: address,
          options: { showType: true, showContent: true },
        });
        const userObject = objects.data.find((obj) =>
          obj.data.type.includes(
            `${packageId}::su_backend::su_messaging::User`
          )
        );
        return userObject?.data.content.fields.display_name
          ? new TextDecoder().decode(
              new Uint8Array(userObject.data.content.fields.display_name)
            )
          : address.slice(0, 6) + "...";
      } catch (err) {
        console.error("Failed to fetch username:", err);
        return address.slice(0, 6) + "...";
      }
    },
    []
  );

  const fetchMessages = useCallback(async () => {
    console.log('fetchMessages called with:', { isConnected, currentAccount: !!currentAccount, recipientAddress });
    if (!isConnected || !currentAccount || !recipientAddress) {
      console.log('fetchMessages: missing requirements', { isConnected, currentAccount: !!currentAccount, recipientAddress });
      return;
    }
    try {
      console.log('fetchMessages: starting fetch for conversation between', currentAccount.address, 'and', recipientAddress);
      const senderAddress = currentAccount.address;
      let allEvents = [];
      let cursor = null;

      // Limit initial fetch to 20 events for faster loading
      const response = await client.queryEvents({
        query: { All: [] },
        limit: 50,
        cursor,
        order: "ascending",
      });
      
      console.log('All events received:', response.data.length, 'events');
      console.log('Event types found:', [...new Set(response.data.map(e => e.type))]);
      
      // Filter for MessageCreated events from our package
      const messageEvents = response.data.filter(event => 
        event.type.includes('MessageCreated') && event.type.includes(packageId)
      );
      
      console.log('Filtered message events:', messageEvents.length);
      console.log('fetchMessages: found', messageEvents.length, 'message events');
      allEvents = [...allEvents, ...messageEvents];
      cursor = response.nextCursor;

      const fetchedMessages = [];
      const seenIds = new Set();
      
      for (const event of allEvents) {
        const eventData = event.parsedJson || {};
        console.log('Processing event:', eventData);
        
        const { message_id, sender, recipient } = eventData;
        if (!message_id || !sender || !recipient) {
          console.log('Missing required fields in event:', { message_id, sender, recipient });
          continue;
        }
        
        // Only process messages between these two users
        if (
          (sender === senderAddress && recipient === recipientAddress) ||
          (sender === recipientAddress && recipient === senderAddress)
        ) {
          try {
            // Get the message object directly using its ID
            const messageObject = await client.getObject({
              id: message_id,
              options: { showContent: true, showType: true },
            });
            
            if (messageObject.data?.content?.fields && !seenIds.has(message_id)) {
              const fields = messageObject.data.content.fields;
              const timestampMs = Long.fromValue(fields.timestamp).toNumber();
              const timestamp = new Date(timestampMs);
              
              // Decode the content (stored as vector<u8> in the contract)
              const content = new TextDecoder().decode(
                new Uint8Array(fields.encrypted_content || [])
              );
              
              console.log('Fetched message:', {
                id: message_id,
                sender: fields.sender,
                recipient: fields.recipient,
                content: content,
                timestamp: timestamp
              });
              
              fetchedMessages.push({
                id: message_id,
                sender: fields.sender,
                recipient: fields.recipient,
                content: content,
                timestamp: timestamp,
                timestampMs: timestampMs,
              });
              seenIds.add(message_id);
            }
          } catch (err) {
            console.error('Failed to fetch message object:', message_id, err);
            // Continue processing other messages even if one fails
          }
        }
      }
      // Preserve optimistically added messages that aren't yet confirmed on blockchain
      setMessages(prevMessages => {
        const confirmedMessages = fetchedMessages.sort((a, b) => a.timestampMs - b.timestampMs);
        const optimisticMessages = prevMessages.filter(msg =>
          msg.id.startsWith('temp-') && !confirmedMessages.some(confirmed =>
            confirmed.sender === msg.sender &&
            confirmed.recipient === msg.recipient &&
            confirmed.content === msg.content &&
            Math.abs(confirmed.timestampMs - msg.timestampMs) < 5000 // Within 5 seconds
          )
        );

        return [...confirmedMessages, ...optimisticMessages].sort((a, b) => a.timestampMs - b.timestampMs);
      });
    } catch (err) {
      setError("Failed to fetch messages: " + err.message);
      console.error("Fetch error details:", err);
    }
  }, [isConnected, currentAccount, recipientAddress, client]);

  const fetchRecentChats = useCallback(async () => {
    if (!isConnected || !currentAccount) return;
    try {
      const senderAddress = currentAccount.address;
      let allEvents = [];
      let cursor = null;
      let hasNextPage = true;

      do {
        const response = await client.queryEvents({
          query: { All: [] },
          limit: 50, // Reduced limit for faster loading
          cursor,
          order: "ascending",
        });
        
        // Filter for MessageCreated events from our package
        const messageEvents = response.data.filter(event => 
          event.type.includes('MessageCreated') && event.type.includes(packageId)
        );
        
        allEvents = [...allEvents, ...messageEvents];
        cursor = response.nextCursor;
        hasNextPage = response.hasNextPage;
      } while (hasNextPage);

      const recipients = new Set();
      for (const event of allEvents) {
        const { sender, recipient } = event.parsedJson || {};
        if (sender === senderAddress) recipients.add(recipient);
        else if (recipient === senderAddress) recipients.add(sender);
      }

      const recipientList = Array.from(recipients);
      const chatData = await Promise.all(
        recipientList.map(async (address) => ({
          address,
          displayName: await fetchUserName(address),
        }))
      );
      setRecentChats(chatData);
    } catch (err) {
      console.error("Failed to fetch recent chats:", err);
    }
  }, [isConnected, currentAccount, client, fetchUserName]);

  useEffect(() => {
    console.log('useEffect triggered for fetchMessages with:', { isConnected, currentAccount: !!currentAccount, recipientAddress });
    fetchMessages();
    fetchRecentChats();
    const fetchNames = async () => {
      if (isConnected && currentAccount && recipientAddress) {
        setRecipientName(await fetchUserName(recipientAddress));
      }
    };
    fetchNames();
  }, [
    isConnected,
    currentAccount,
    recipientAddress,
    fetchMessages,
    fetchRecentChats,
    fetchUserName,
  ]);

  // Periodic check for message confirmations
  useEffect(() => {
    if (!isConnected || !messages.some(msg => msg.id.startsWith('temp-'))) {
      return; // No optimistic messages to confirm
    }

    const interval = setInterval(() => {
      fetchMessages();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isConnected, messages, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !isConnected) return;

    setSendStatus(true);
    try {
      console.log("Sending message to:", recipientAddress);
      console.log("Current account:", currentAccount?.address);

      // Validate recipient address
      if (!recipientAddress || !/^0x[a-fA-F0-9]{64}$/.test(recipientAddress)) {
        throw new Error("Invalid recipient address: " + recipientAddress);
      }

      // Prevent sending to oneself
      if (recipientAddress === currentAccount?.address) {
        throw new Error("Cannot send message to yourself");
      }

      const cleanedMessage = message.trim().replace(/\s+/g, " ").slice(0, 100);
      const content = new TextEncoder().encode(cleanedMessage);

      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::su_messaging::send_message`,
        arguments: [
          tx.pure.address(recipientAddress),
          tx.pure(bcs.vector(bcs.u8()).serialize(Array.from(content))),
          tx.object("0x0000000000000000000000000000000000000000000000000000000000000006"), // Clock object
        ],
      });

      console.log('Sending transaction with packageId:', packageId);
      console.log('Transaction details:', {
        target: `${packageId}::su_messaging::send_message`,
        recipient: recipientAddress,
        contentLength: content.length,
        clock: "0x0000000000000000000000000000000000000000000000000000000000000006"
      });

      console.log('About to call signAndExecuteTransactionBlock with:', {
        transaction: tx,
        packageId,
        target: `${packageId}::su_backend::su_messaging::send_message`,
        options: {
          showEffects: true,
          showEvents: true,
        }
      });

      const result = await signAndExecuteTransactionBlock({
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      console.log('Transaction result:', result);
      console.log('Transaction effects:', result?.effects);
      console.log('Transaction events:', result?.events);

      // Check if transaction was successful
      const isSuccess = result && result.effects && result.effects.status && result.effects.status.status === 'success';
      
      console.log('Transaction success check:', isSuccess);
      
      if (isSuccess) {
        console.log('Transaction completed successfully');

        // Optimistically add the message to the UI immediately
        const newMessage = {
          id: `temp-${Date.now()}`, // Temporary ID
          sender: currentAccount.address,
          recipient: recipientAddress,
          content: cleanedMessage,
          timestamp: new Date(),
          timestampMs: Date.now(),
        };
        setMessages(prevMessages => [...prevMessages, newMessage]);

        setSendStatus(false);
        setMessage("");
        // Fetch messages in background to confirm the transaction
        setTimeout(() => fetchMessages(), 1000);
      } else {
        console.error('Transaction failed or result undefined:', result);
        throw new Error('Transaction failed: ' + (result ? JSON.stringify(result) : 'No result returned'));
      }
    } catch (err) {
      console.error('Transaction failed with error:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      setError("Failed to send: " + err.message);
      setSendStatus(false);
    }
  };

  const scrollToBottom = () => {
    if (chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  };

  return (
    <Container
      className="mt-5"
      style={{
        maxWidth: "1200px",
        minHeight: "600px", // Fixed minimum height for one-size-fits-all
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #1a0033, #330066)",
        border: "5px solid #ff00ff",
        borderRadius: "10px",
        boxShadow: "0 0 20px #00ffff",
        fontFamily: "Orbitron, sans-serif",
        color: "#00ffff",
        padding: "10px",
      }}
    >
      {sendStatus && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              fontSize: "40px",
              color: "#ff00ff",
              textShadow: "0 0 20px #00ffff",
              animation: "blink 1s infinite",
            }}
          >
            SENDING...
          </div>
          <style>{`
            @keyframes blink {
              50% { opacity: 0; }
            }
          `}</style>
        </div>
      )}
      <Row
        style={{
          flex: "1",
          display: "flex",
          flexDirection: "row",
          minHeight: "0",
        }}
      >
        <Col
          md={3}
          style={{
            backgroundColor: "#1a0033",
            minHeight: "100%",
            position: "relative",
            padding: "0",
            borderRight: "3px dashed #ff00ff",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: "0",
              backgroundColor: "#330066",
              padding: "10px 0",
              height: "60px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              borderBottom: "2px solid #ff00ff",
              flexShrink: 0,
            }}
          >
            <h4
              style={{
                fontWeight: "bold",
                margin: "0",
                textShadow: "0 0 10px #00ffff",
              }}
            >
              CHAT LIST
            </h4>
          </div>
          <ListGroup
            style={{
              flex: "1",
              overflowY: "auto", // Enabled scrolling
              maxHeight: "calc(600px - 170px)", // Adjusted for header and padding
              background: "rgba(0, 0, 0, 0.5)",
            }}
          >
            {recentChats.map((chat, index) => (
              <ListGroup.Item
                key={index}
                action
                onClick={() => navigate(`/chat/${chat.address}`)}
                active={chat.address === recipientAddress}
                style={{
                  backgroundColor:
                    chat.address === recipientAddress ? "#00ffff" : "#1a0033",
                  color:
                    chat.address === recipientAddress ? "#330066" : "#00ffff",
                  borderBottom: "1px dashed #ff00ff",
                  padding: "10px",
                  transition: "background-color 0.3s",
                  cursor: "pointer",
                  fontSize: "16px",
                  textShadow: "0 0 5px #ff00ff",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = "#00ccff")
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor =
                    chat.address === recipientAddress ? "#00ffff" : "#1a0033")
                }
              >
                {chat.displayName}
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Col>
        <Col
          md={9}
          style={{
            padding: "0",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            minHeight: "0",
            flex: "1",
          }}
        >
          <div
            style={{
              position: "relative",
              padding: "10px 0",
              height: "60px",
              backgroundColor: "#330066",
              borderBottom: "2px solid #ff00ff",
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                margin: "0",
                textAlign: "center",
                textShadow: "0 0 15px #00ffff",
              }}
            >
              CHATTING WITH {recipientName.toUpperCase()}
            </h2>
            <Button
              variant="secondary"
              onClick={scrollToBottom}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                padding: "5px 10px",
                fontSize: "16px",
                backgroundColor: "#ff00ff",
                borderColor: "#ff00ff",
                textShadow: "0 0 5px #00ffff",
              }}
            >
              ↓
            </Button>
          </div>
          <div
            ref={chatContentRef}
            style={{
              flexGrow: 1,
              overflowY: "auto", // Enabled scrolling
              padding: "15px",
              background: "rgba(0, 0, 0, 0.7)",
              border: "2px solid #ff00ff",
              borderRadius: "5px",
              maxHeight: "calc(600px - 240px)", // Adjusted for header, input, and padding
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    backgroundColor: "#1a0033",
                    color: "#00ffff",
                    textAlign: "center",
                    border: "1px solid #ff00ff",
                    padding: "10px",
                    borderRadius: "8px",
                  }}
                >
                  NO MESSAGES YET. START CHATTING!
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      backgroundColor:
                        msg.sender === currentAccount?.address
                          ? "#00ffff"
                          : "#1a0033",
                      color:
                        msg.sender === currentAccount?.address
                          ? "#330066"
                          : "#00ffff",
                      textAlign:
                        msg.sender === currentAccount?.address
                          ? "right"
                          : "left",
                      margin: "5px 0",
                      borderRadius: "8px",
                      maxWidth: "70%",
                      marginLeft:
                        msg.sender === currentAccount?.address
                          ? "auto"
                          : "10px",
                      padding: "10px",
                      border: msg.id.startsWith('temp-')
                        ? "2px dashed #ffff00"
                        : "1px dashed #ff00ff",
                      boxShadow: "0 0 10px rgba(0, 255, 255, 0.5)",
                      fontSize: "14px",
                      textShadow: "0 0 3px #ff00ff",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      opacity: msg.id.startsWith('temp-') ? 0.8 : 1,
                    }}
                  >
                    <strong>
                      {msg.sender === currentAccount?.address
                        ? "YOU"
                        : msg.sender.slice(0, 6) + "..."}
                      :
                    </strong>{" "}
                    {msg.content}
                    {msg.id.startsWith('temp-') && (
                      <span style={{ color: "#ffff00", marginLeft: "8px", fontSize: "12px" }}>
                        ⏳ Sending...
                      </span>
                    )}
                    <br />
                    <small
                      style={{
                        fontSize: "10px",
                        color:
                          msg.sender === currentAccount?.address
                            ? "#330066"
                            : "#ff00ff",
                      }}
                    >
                      {msg.timestamp instanceof Date && !isNaN(msg.timestamp)
                        ? msg.timestamp.toLocaleString()
                        : "Unknown Time"}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>
          <div
            className="mt-2 p-2"
            style={{
              backgroundColor: "#330066",
              borderTop: "2px solid #ff00ff",
              flexShrink: 0,
              height: "100px", // Fixed height to keep input and button visible
              display: "flex",
              alignItems: "center",
            }}
          >
            <Form
              onSubmit={handleSend}
              style={{ width: "100%", display: "flex", gap: "10px" }}
            >
              <Form.Control
                as="textarea"
                placeholder="TYPE YOUR MESSAGE..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend(e)
                }
                style={{
                  flex: "1",
                  minHeight: "40px",
                  padding: "10px",
                  backgroundColor: "#1a0033",
                  color: "#00ffff",
                  border: "2px solid #ff00ff",
                  borderRadius: "5px",
                  resize: "none",
                  fontFamily: "Orbitron, sans-serif",
                  textShadow: "0 0 3px #ff00ff",
                }}
                disabled={!isConnected}
              />
              <Button
                variant="primary"
                type="submit"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#ff00ff",
                  borderColor: "#ff00ff",
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "16px",
                  textShadow: "0 0 5px #00ffff",
                }}
                disabled={!isConnected}
              >
                SEND
              </Button>
            </Form>
            {!isConnected && (
              <Alert
                variant="danger"
                style={{
                  marginTop: "10px",
                  textAlign: "center",
                  color: "#ff00ff",
                  backgroundColor: "#330066",
                  border: "1px solid #ff00ff",
                }}
              >
                PLEASE CONNECT YOUR SUI WALLET TO SEND MESSAGES.
              </Alert>
            )}
            {error && (
              <Alert
                variant="danger"
                style={{
                  marginTop: "10px",
                  textAlign: "center",
                  color: "#ff00ff",
                  backgroundColor: "#330066",
                  border: "1px solid #ff00ff",
                }}
              >
                {error}
              </Alert>
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default Chat;
