import React, { useState, useEffect, useRef } from "react";
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
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useWalletKit } from "@mysten/wallet-kit";
import { SuiClient } from "@mysten/sui.js/client";

function Chat() {
  const { id: recipientAddress } = useParams();
  const navigate = useNavigate();
  const { signAndExecuteTransactionBlock, isConnected, currentAccount } =
    useWalletKit();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sendStatus, setSendStatus] = useState(false);
  const [error, setError] = useState(null); // Fixed: Ensure setError is defined
  const [recipientName, setRecipientName] = useState(
    recipientAddress || "Stranger"
  );
  const [userName, setUserName] = useState(
    currentAccount?.address.slice(0, 6) + "..." || "RetroUser"
  );
  const [recentChats, setRecentChats] = useState([]);
  const chatContentRef = useRef(null);
  const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" }); // Mainnet endpoint
  const packageId =
    "0x3c7d131d38c117cbc75e3a8349ea3c841776ad6c6168e9590ba1fc4478018799"; // Deployed Mainnet package ID

  useEffect(() => {
    fetchMessages();
    fetchRecentChats();
    const fetchNames = async () => {
      if (isConnected && currentAccount && recipientAddress) {
        setRecipientName(await fetchUserName(recipientAddress));
        setUserName(await fetchUserName(currentAccount.address));
      }
    };
    fetchNames();
    if (chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [isConnected, currentAccount, recipientAddress]);

  const fetchUserName = async (address) => {
    if (!isConnected || !currentAccount) return address.slice(0, 6) + "...";
    const objects = await client.getOwnedObjects({
      owner: address,
      options: { showType: true, showContent: true },
    });
    const userObject = objects.data.find((obj) =>
      obj.data.type.includes(
        "0x3f455d572c2b923918a0623bef2e075b9870dc650c2f9e164aa2ea5693506d80::su_messaging::User"
      )
    );
    return userObject?.data.content.fields.display_name
      ? new TextDecoder().decode(
          new Uint8Array(userObject.data.content.fields.display_name)
        )
      : address.slice(0, 6) + "...";
  };

  const fetchMessages = async () => {
    if (!isConnected || !currentAccount || !recipientAddress) return;
    try {
      const senderAddress = currentAccount.address;
      let allEvents = [];
      let cursor = null;
      let hasNextPage = true;

      do {
        const response = await client.queryEvents({
          query: { MoveEventType: `${packageId}::message::MessageCreated` },
          limit: 100,
          cursor,
        });
        allEvents = [...allEvents, ...response.data];
        cursor = response.nextCursor;
        hasNextPage = response.hasNextPage;
      } while (hasNextPage);

      const fetchedMessages = [];
      for (const event of allEvents) {
        const { id, sender, recipient } = event.parsedJson || {};
        if (
          (sender === senderAddress && recipient === recipientAddress) ||
          (sender === recipientAddress && recipient === senderAddress)
        ) {
          const messageObj = await client.getObject({
            id: id,
            options: { showContent: true },
          });
          if (
            messageObj.data &&
            messageObj.data.content &&
            messageObj.data.content.fields
          ) {
            const fields = messageObj.data.content.fields;
            fetchedMessages.push({
              id: id,
              sender: fields.sender,
              recipient: fields.recipient,
              content: new TextDecoder().decode(new Uint8Array(fields.content)),
              timestamp: fields.timestamp,
            });
          }
        }
      }
      setMessages(fetchedMessages.sort((a, b) => a.timestamp - b.timestamp));
    } catch (err) {
      setError("Failed to fetch messages: " + err.message);
      console.error(err);
    }
  };

  const fetchRecentChats = async () => {
    if (!isConnected || !currentAccount) return;
    try {
      const senderAddress = currentAccount.address;
      let allEvents = [];
      let cursor = null;
      let hasNextPage = true;

      do {
        const response = await client.queryEvents({
          query: { MoveEventType: `${packageId}::message::MessageCreated` },
          limit: 100,
          cursor,
        });
        allEvents = [...allEvents, ...response.data];
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
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !isConnected) return;

    setSendStatus(true);
    try {
      const tx = new TransactionBlock();
      const content = new TextEncoder().encode(message);
      tx.moveCall({
        target: `${packageId}::message::send_message`,
        arguments: [
          tx.pure(currentAccount.address),
          tx.pure(recipientAddress),
          tx.pure(content),
        ],
      });

      const result = await signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: { showEffects: true },
        account: currentAccount,
      });

      console.log("Send result:", result);
      setSendStatus(false);
      fetchMessages(); // Refresh messages
    } catch (err) {
      setError("Failed to send: " + err.message);
      console.error(err);
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
        maxWidth: "1000px",
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
          overflow: "hidden",
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
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
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
            height: "100%",
            background: "linear-gradient(135deg, #330066, #1a0033)",
          }}
        >
          <div
            style={{
              position: "relative",
              padding: "10px 0",
              height: "60px",
              backgroundColor: "#330066",
              borderBottom: "2px solid #ff00ff",
              flexShrink: "0",
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
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
              padding: "15px",
              background: "rgba(0, 0, 0, 0.7)",
              border: "2px solid #ff00ff",
              borderRadius: "5px",
            }}
          >
            <ListGroup>
              {messages.length === 0 ? (
                <ListGroup.Item
                  style={{
                    backgroundColor: "#1a0033",
                    color: "#00ffff",
                    textAlign: "center",
                    border: "1px solid #ff00ff",
                  }}
                >
                  NO MESSAGES YET. START CHATTING!
                </ListGroup.Item>
              ) : (
                messages.map((msg) => (
                  <ListGroup.Item
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
                      border: "1px dashed #ff00ff",
                      boxShadow: "0 0 10px rgba(0, 255, 255, 0.5)",
                      fontSize: "14px",
                      textShadow: "0 0 3px #ff00ff",
                    }}
                  >
                    <strong>
                      {msg.sender === currentAccount?.address
                        ? "YOU"
                        : msg.sender.slice(0, 6) + "..."}
                      :
                    </strong>{" "}
                    {msg.content}
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
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </small>
                  </ListGroup.Item>
                ))
              )}
            </ListGroup>
          </div>
          <div
            className="mt-2 p-2"
            style={{
              backgroundColor: "#330066",
              borderTop: "2px solid #ff00ff",
              flexShrink: "0",
              height: "100px",
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
                  color: "#ff0000",
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
                  color: "#ff0000",
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
