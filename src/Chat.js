import React, { useState, useEffect } from "react";
import { Container, Button, ListGroup, Alert } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useWalletKit } from "@mysten/wallet-kit";
import { SuiClient } from "@mysten/sui.js/client";

function Chat() {
  const { id: recipientAddress } = useParams();
  const { signAndExecuteTransactionBlock, isConnected, currentAccount } =
    useWalletKit();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sendStatus, setSendStatus] = useState(false);
  const [error, setError] = useState(null);
  const [recipientName, setRecipientName] = useState(recipientAddress);
  const [userName, setUserName] = useState(currentAccount?.address || "");
  const client = new SuiClient({ url: "https://fullnode.devnet.sui.io:443" });

  const fetchUserName = async (address) => {
    const objects = await client.getOwnedObjects({
      owner: address,
      options: { showType: true, showContent: true },
    });
    const userObject = objects.data.find((obj) =>
      obj.data.type.includes(
        "0x62c1db5b7060a2d7207430b62c94dcfa50aaf1d5a09fb3a39f2869c86cd6f61b::su_messaging::User"
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
      const packageId =
        "0x62c1db5b7060a2d7207430b62c94dcfa50aaf1d5a09fb3a39f2869c86cd6f61b";

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
        allEvents = [...allEvents, ...response.data];
        cursor = response.nextCursor;
        hasNextPage = response.hasNextPage;
      } while (hasNextPage);

      const fetchedMessages = [];
      for (const event of allEvents) {
        const { message_id, sender, recipient } = event.parsedJson;
        if (
          (sender === senderAddress && recipient === recipientAddress) ||
          (sender === recipientAddress && recipient === senderAddress)
        ) {
          const messageObj = await client.getObject({
            id: message_id,
            options: { showContent: true },
          });
          if (
            messageObj.data &&
            messageObj.data.content &&
            messageObj.data.content.fields
          ) {
            const fields = messageObj.data.content.fields;
            fetchedMessages.push({
              sender: await fetchUserName(fields.sender),
              recipient: await fetchUserName(fields.recipient),
              content: new TextDecoder().decode(
                new Uint8Array(fields.encrypted_content)
              ),
              timestamp: fields.timestamp
                ? Number(fields.timestamp)
                : Date.now(),
              isRead: fields.is_read ? fields.is_read : false,
            });
          }
        }
      }

      fetchedMessages.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(fetchedMessages);
    } catch (err) {
      setError("Failed to fetch messages: " + err.message);
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const fetchNames = async () => {
      if (isConnected && currentAccount && recipientAddress) {
        setRecipientName(await fetchUserName(recipientAddress));
        setUserName(await fetchUserName(currentAccount.address));
      }
    };
    fetchNames();
  }, [isConnected, currentAccount, recipientAddress]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (e.type === "keydown" && e.key !== "Enter") return;
    if (!message.trim()) return;
    if (!isConnected) {
      setError("Please connect your wallet first.");
      return;
    }

    if (!recipientAddress) {
      setError("Recipient address is required.");
      return;
    }

    setError(null);
    setSendStatus(true);

    try {
      const tx = new TransactionBlock();
      const packageId =
        "0x62c1db5b7060a2d7207430b62c94dcfa50aaf1d5a09fb3a39f2869c86cd6f61b";

      const clock = tx.sharedObjectRef({
        objectId:
          "0x0000000000000000000000000000000000000000000000000000000000000006",
        initialSharedVersion: 1,
        mutable: false,
      });

      tx.moveCall({
        target: `${packageId}::su_messaging::send_message`,
        arguments: [tx.pure(recipientAddress), tx.pure(message), clock],
      });

      const result = await signAndExecuteTransactionBlock({
        transactionBlock: tx,
        requestType: "WaitForLocalExecution",
      });

      console.log("Send message result:", result);
      console.log("Transaction digest:", result.digest);
      setMessage("");
      fetchMessages();
    } catch (err) {
      setError("Failed to send message: " + err.message);
      console.error(err);
    } finally {
      setTimeout(() => setSendStatus(false), 3000);
    }
  };

  // Simulate read receipt for sender's messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.sender === userName && !msg.isRead
            ? { ...msg, isRead: true }
            : msg
        )
      );
    }, 2000);
    return () => clearInterval(interval);
  }, [messages, userName]);

  return (
    <Container className="mt-5" style={{ maxWidth: "600px" }}>
      <h2 className="text-center">Chat with {recipientName}</h2>
      <ListGroup className="mt-4">
        {messages.length === 0 ? (
          <ListGroup.Item
            style={{ backgroundColor: "var(--accent-dark)", color: "#e0f7fa" }}
          >
            No messages yet.
          </ListGroup.Item>
        ) : (
          messages.map((msg, index) => (
            <ListGroup.Item
              key={index}
              style={{
                backgroundColor:
                  msg.sender === userName ? "#1e90ff" : "#e0f7fa",
                color: msg.sender === userName ? "#ffffff" : "#000000",
                textAlign: msg.sender === userName ? "right" : "left",
                margin: "5px 0",
                borderRadius: "10px",
                maxWidth: "60%",
                marginLeft: msg.sender === userName ? "auto" : "0",
                boxShadow: msg.isRead
                  ? "0 0 10px #ffd700"
                  : msg === messages[messages.length - 1] &&
                    msg.sender === userName &&
                    sendStatus
                  ? "0 0 10px #32cd32"
                  : "none",
                animation:
                  msg.isRead ||
                  (msg === messages[messages.length - 1] &&
                    msg.sender === userName &&
                    sendStatus)
                    ? "glow 1.5s infinite"
                    : "none",
              }}
            >
              <strong>{msg.sender === userName ? "You" : msg.sender}:</strong>{" "}
              {msg.content}
              <br />
              <small style={{ fontSize: "0.7em", color: "#888" }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </small>
            </ListGroup.Item>
          ))
        )}
      </ListGroup>
      <div className="mt-4">
        <textarea
          placeholder="Type your message here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)} // Basic textarea for typing
          style={{
            width: "100%",
            minHeight: "40px",
            maxHeight: "100px",
            padding: "5px",
            backgroundColor: "#333",
            color: "#e0f7fa",
            border: "1px solid #1e90ff",
            borderRadius: "10px",
          }}
        />
        <Button
          variant="primary"
          onClick={handleSendMessage} // Changed to onClick for simplicity
          style={{
            backgroundColor: "#1e90ff",
            borderColor: "#1e90ff",
            marginTop: "5px",
            float: "right",
          }}
        >
          Send
        </Button>
        {sendStatus && (
          <Alert variant="success" className="mt-3">
            Message sent!
          </Alert>
        )}
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </div>
    </Container>
  );
}

export default Chat;
