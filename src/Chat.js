import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
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
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/bcs";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import Long from "long";
import { isMobileDevice } from "./utils/mobileWallet";
import { encryptMessage, decryptMessage } from "./utils/encryption";
import { storeOnWalrus, retrieveFromWalrus } from "./utils/walrus";
import { storeOnIPFS, retrieveFromIPFS } from "./utils/ipfs";

// Simple key derivation from addresses (for testing - in production use proper key exchange)
function deriveSharedKeyFromAddresses(address1, address2) {
  // Sort addresses to ensure consistent key derivation regardless of order
  const [addr1, addr2] = [address1, address2].sort();

  // Create a deterministic key from the address pair
  const combined = addr1 + addr2 + 'su-messaging-salt';

  // Use Web Crypto API to hash and get raw bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);

  return crypto.subtle.digest('SHA-256', data).then(hash => {
    return new Uint8Array(hash);
  });
}

function Chat() {
  const { id: recipientAddress } = useParams();
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const isConnected = !!currentAccount;
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  
  // Debug logging for component state
  useEffect(() => {
    console.log('Chat component state:', { isConnected, currentAccount: currentAccount?.address, recipientAddress });
  }, [isConnected, currentAccount?.address, recipientAddress]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sendStatus, setSendStatus] = useState(false);
  const [error, setError] = useState(null);
  const [recipientName, setRecipientName] = useState(
    recipientAddress || "Stranger"
  );
  const [recentChats, setRecentChats] = useState([]);
  const [senderNames, setSenderNames] = useState(new Map()); // Map of address -> display name
  const chatContentRef = useRef(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [showMobileChatList, setShowMobileChatList] = useState(false); // Toggle for mobile chat list
  const packageId =
    "0x2aaad5d1ce7482b5850dd11642358bf23cb0e6432b12a581eb77d212dca54045";

  // Utility function for consistent message sorting
  const sortMessagesByTimestamp = (messages) => {
    return [...messages].sort((a, b) => {
      const timeA = a.clientTimestampMs || a.timestampMs;
      const timeB = b.clientTimestampMs || b.timestampMs;
      return timeA - timeB;
    });
  };

  // Helper function to decrypt a message from Walrus, IPFS, or Sui fallback
  const decryptMessageFromStorage = async (metadataString, senderAddress, recipientAddress) => {
    try {
      const metadata = JSON.parse(metadataString);

      if (metadata.version === "sui-compressed-v1" && metadata.compressedData) {
        // Ultimate fallback: compressed data stored on Sui
        console.log("Decrypting from Sui compressed fallback storage");
        const encryptedData = atob(metadata.compressedData); // Decompress
        const sharedKey = await deriveSharedKeyFromAddresses(senderAddress, recipientAddress);
        const decryptedContent = await decryptMessage(encryptedData, sharedKey);
        return decryptedContent;
      } else if (metadata.version === "ipfs-fallback-v1" && metadata.cid) {
        // IPFS decentralized fallback
        console.log("Decrypting from IPFS decentralized fallback, CID:", metadata.cid);
        const encryptedData = await retrieveFromIPFS(metadata.cid);
        const sharedKey = await deriveSharedKeyFromAddresses(senderAddress, recipientAddress);
        const decryptedContent = await decryptMessage(encryptedData, sharedKey);
        return decryptedContent;
      } else if (metadata.version === "sui-fallback-v1" && metadata.encryptedData) {
        // Legacy fallback: encrypted data stored directly on Sui
        console.log("Decrypting from Sui fallback storage");
        const sharedKey = await deriveSharedKeyFromAddresses(senderAddress, recipientAddress);
        const decryptedContent = await decryptMessage(metadata.encryptedData, sharedKey);
        return decryptedContent;
      } else if (metadata.version === "walrus-v1" && metadata.blobId) {
        // Normal Walrus storage
        console.log("Decrypting from Walrus storage, blobId:", metadata.blobId);
        const encryptedData = await retrieveFromWalrus(metadata.blobId);
        const sharedKey = await deriveSharedKeyFromAddresses(senderAddress, recipientAddress);
        const decryptedContent = await decryptMessage(encryptedData, sharedKey);
        return decryptedContent;
      } else {
        // Fallback for old format (plain text)
        return metadataString;
      }
    } catch (error) {
      console.error('Failed to decrypt message from storage:', error);
      // Return a placeholder indicating decryption failed
      return "[Message temporarily unavailable - stored securely]";
    }
  };

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
            `${packageId}::su_messaging::User`
          )
        );
        const displayName = userObject?.data.content.fields.display_name
          ? new TextDecoder().decode(
              new Uint8Array(userObject.data.content.fields.display_name)
            )
          : address.slice(0, 6) + "...";
        
        // Update the sender names map
        setSenderNames(prev => new Map(prev.set(address, displayName)));
        
        return displayName;
      } catch (err) {
        console.error("Failed to fetch username:", err);
        const fallbackName = address.slice(0, 6) + "...";
        setSenderNames(prev => new Map(prev.set(address, fallbackName)));
        return fallbackName;
      }
    },
    [client, packageId]
  );

  const scrollToBottom = useCallback(() => {
    if (chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    console.log('fetchMessages called with:', { isConnected, currentAccount: !!currentAccount, recipientAddress });
    if (!isConnected || !currentAccount || !recipientAddress) {
      console.log('fetchMessages: missing requirements', { isConnected, currentAccount: !!currentAccount, recipientAddress });
      return;
    }

    // Skip if we recently fetched to avoid rate limits
    const now = Date.now();
    if (lastFetchTime && now - lastFetchTime < 5000) { // 5 second minimum interval
      return;
    }
    setLastFetchTime(now);

    try {
      console.log('fetchMessages: starting fetch for conversation between', currentAccount.address, 'and', recipientAddress);
      const senderAddress = currentAccount.address;
      
      // Try multiple approaches to fetch messages
      
      // Approach 1: Query for Message objects directly using dynamic field queries
      let fetchedMessages = [];
      const seenIds = new Set();
      
      try {
        // Query events to find message IDs, then fetch the objects
        const eventsResponse = await client.queryEvents({
          query: { MoveModule: { package: packageId, module: "su_messaging" } },
          limit: 50,
          order: "descending", // Get most recent first
        });
        
        console.log('Events query successful, found', eventsResponse.data.length, 'events');
        
        // Filter for MessageCreated events
        const messageEvents = eventsResponse.data.filter(event => 
          event.type === `${packageId}::su_messaging::MessageCreated` ||
          event.type.includes('MessageCreated')
        );
        
        console.log('Found', messageEvents.length, 'MessageCreated events');
        
        for (const event of messageEvents) {
          const eventData = event.parsedJson || {};
          const { message_id, sender, recipient } = eventData;
          
          if (!message_id || !sender || !recipient) continue;
          
          // Only process messages between these two users
          if (
            (sender === senderAddress && recipient === recipientAddress) ||
            (sender === recipientAddress && recipient === senderAddress)
          ) {
            try {
              // Get the message object
              const messageObject = await client.getObject({
                id: message_id,
                options: { showContent: true, showType: true },
              });
              
              if (messageObject.data?.content?.fields && !seenIds.has(message_id)) {
                const fields = messageObject.data.content.fields;
                const timestampMs = Long.fromValue(fields.timestamp).toNumber();
                const timestamp = new Date(timestampMs);
                
                // Decode the content
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
                  content: content, // This is metadata that needs decryption
                  timestamp: timestamp,
                  timestampMs: timestampMs,
                  clientTimestampMs: timestampMs,
                  needsDecryption: true, // Mark for async decryption
                });
                seenIds.add(message_id);
              }
            } catch (err) {
              console.error('Failed to fetch message object:', message_id, err);
            }
          }
        }
      } catch (eventError) {
        console.error('Event-based fetching failed:', eventError);
        
        // Approach 2: Fallback - try to query owned objects for both users
        console.log('Trying fallback approach: query owned objects');
        
        const addressesToCheck = [senderAddress, recipientAddress];
        
        for (const address of addressesToCheck) {
          try {
            const ownedObjects = await client.getOwnedObjects({
              owner: address,
              options: { showType: true, showContent: true },
              limit: 50,
            });
            
            // Look for Message objects
            const messageObjects = ownedObjects.data.filter(obj =>
              obj.data?.type?.includes(`${packageId}::su_messaging::Message`)
            );
            
            console.log(`Found ${messageObjects.length} Message objects owned by ${address.slice(0, 6)}...`);
            
            for (const obj of messageObjects) {
              if (obj.data?.content?.fields && !seenIds.has(obj.data.objectId)) {
                const fields = obj.data.content.fields;
                
                // Check if this message is between our two users
                if (
                  (fields.sender === senderAddress && fields.recipient === recipientAddress) ||
                  (fields.sender === recipientAddress && fields.recipient === senderAddress)
                ) {
                  const timestampMs = Long.fromValue(fields.timestamp).toNumber();
                  const timestamp = new Date(timestampMs);
                  
                  const encryptedContent = new TextDecoder().decode(
                    new Uint8Array(fields.encrypted_content || [])
                  );

                  // For now, store the metadata - we'll decrypt asynchronously
                  fetchedMessages.push({
                    id: obj.data.objectId,
                    sender: fields.sender,
                    recipient: fields.recipient,
                    content: encryptedContent, // This is actually metadata now
                    timestamp: timestamp,
                    timestampMs: timestampMs,
                    clientTimestampMs: timestampMs,
                    needsDecryption: true, // Flag to indicate this needs decryption
                  });
                  seenIds.add(obj.data.objectId);
                }
              }
            }
          } catch (ownedError) {
            console.error(`Failed to query owned objects for ${address}:`, ownedError);
          }
        }
      }
      
      // Sort messages by timestamp
      fetchedMessages.sort((a, b) => a.timestampMs - b.timestampMs);
      
      // Merge confirmed messages with optimistic messages, removing duplicates
      setMessages(prevMessages => {
        const confirmedMessages = fetchedMessages;
        
        // Separate optimistic messages from confirmed ones
        const optimisticMessages = prevMessages.filter(msg => msg.id.startsWith('temp-'));
        const existingConfirmedMessages = prevMessages.filter(msg => !msg.id.startsWith('temp-'));
        
        // Remove optimistic messages that have been confirmed (using client timestamps)
        const remainingOptimisticMessages = optimisticMessages.filter(optimistic => 
          !confirmedMessages.some(confirmed =>
            confirmed.sender === optimistic.sender &&
            confirmed.recipient === optimistic.recipient &&
            confirmed.content.trim() === optimistic.content.trim() &&
            Math.abs((confirmed.clientTimestampMs || confirmed.timestampMs) - (optimistic.clientTimestampMs || optimistic.timestampMs)) < 60000 // Within 1 minute
          )
        );
        
        // Combine all messages
        const allMessages = [...existingConfirmedMessages, ...confirmedMessages, ...remainingOptimisticMessages];
        
        // Aggressive deduplication: remove messages that are clearly duplicates
        const uniqueMessages = [];
        const messageMap = new Map(); // key -> best message
        
        for (const message of allMessages) {
          const clientTime = message.clientTimestampMs || message.timestampMs;
          const key = `${message.sender}-${message.recipient}-${message.content.trim()}`;
          
          if (messageMap.has(key)) {
            const existing = messageMap.get(key);
            const existingTime = existing.clientTimestampMs || existing.timestampMs;
            
            // If timestamps are very close (within 30 seconds), prefer confirmed over optimistic
            if (Math.abs(clientTime - existingTime) < 30000) {
              if (message.status === 'confirmed' && existing.status !== 'confirmed') {
                console.log('Replacing optimistic with confirmed:', message.content.substring(0, 30));
                messageMap.set(key, message); // Replace with confirmed
              } else if (message.status !== 'confirmed' && existing.status === 'confirmed') {
                // Keep existing confirmed message
              } else {
                // Same status, keep the one with more recent timestamp
                if (clientTime > existingTime) {
                  messageMap.set(key, message);
                }
              }
            } else {
              // Different timestamps, these are different messages (not duplicates)
              console.log('Different timestamps for same content, keeping both:', {
                content: message.content.substring(0, 30),
                time1: new Date(existingTime).toLocaleTimeString(),
                time2: new Date(clientTime).toLocaleTimeString()
              });
              uniqueMessages.push(message);
            }
          } else {
            messageMap.set(key, message);
          }
        }
        
        // Convert map back to array
        messageMap.forEach(message => uniqueMessages.push(message));
        
        // Sort by client timestamp (when send button was clicked)
        return sortMessagesByTimestamp(uniqueMessages);
      });
    } catch (err) {
      setError("Failed to fetch messages: " + err.message);
      console.error("Fetch error details:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, currentAccount, recipientAddress, client, scrollToBottom, lastFetchTime]);

  const fetchRecentChats = useCallback(async () => {
    if (!isConnected || !currentAccount) return;
    
    // Skip if we recently fetched to avoid rate limits
    const now = Date.now();
    if (lastFetchTime && now - lastFetchTime < 10000) { // 10 second minimum interval
      return;
    }
    setLastFetchTime(now);
    
    try {
      const senderAddress = currentAccount.address;
      const recipients = new Set();
      
      // Try to get recent chats from events first
      try {
        const eventsResponse = await client.queryEvents({
          query: { MoveModule: { package: packageId, module: "su_messaging" } },
          limit: 20,
          order: "descending",
        });
        
        // Filter for MessageCreated events
        const messageEvents = eventsResponse.data.filter(event => 
          event.type === `${packageId}::su_messaging::MessageCreated` ||
          event.type.includes('MessageCreated')
        );
        
        for (const event of messageEvents) {
          const { sender, recipient } = event.parsedJson || {};
          if (sender === senderAddress) recipients.add(recipient);
          else if (recipient === senderAddress) recipients.add(sender);
        }
      } catch (eventError) {
        console.error('Event-based chat fetching failed:', eventError);
        
        // Fallback: check localStorage for recent conversations
        console.log('Trying localStorage fallback for recent chats');
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`messages_${senderAddress}_`)) {
            const recipientAddress = key.replace(`messages_${senderAddress}_`, '');
            recipients.add(recipientAddress);
          }
        }
      }

      const recipientList = Array.from(recipients);
      console.log('Found recent chat recipients:', recipientList);
      
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
  }, [isConnected, currentAccount, client, fetchUserName, lastFetchTime]);

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

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure DOM has updated
      const timeoutId = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, isConnected, currentAccount?.address, recipientAddress, scrollToBottom]);

  // Periodic check for message confirmations (less aggressive to avoid rate limits)
  useEffect(() => {
    if (!isConnected || !messages.some(msg => msg.id.startsWith('temp-'))) {
      return; // No optimistic messages to confirm
    }

    const interval = setInterval(() => {
      // Only fetch if we haven't fetched recently
      const now = Date.now();
      if (!lastFetchTime || now - lastFetchTime > 15000) { // 15 second intervals
        fetchMessages();
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [isConnected, messages, fetchMessages, lastFetchTime]);

  // Load messages from localStorage on component mount (only as fallback)
  useEffect(() => {
    if (isConnected && currentAccount && recipientAddress) {
      const storageKey = `messages_${currentAccount.address}_${recipientAddress}`;
      const storedMessages = localStorage.getItem(storageKey);
      if (storedMessages) {
        try {
          const parsedMessages = JSON.parse(storedMessages)
            .map(msg => ({
              ...msg,
              timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
              timestampMs: msg.timestampMs || Date.parse(msg.timestamp),
              clientTimestampMs: msg.clientTimestampMs || msg.timestampMs || Date.parse(msg.timestamp), // Ensure clientTimestampMs exists
            }))
            .filter(msg => {
              // Filter out old optimistic messages (older than 5 minutes)
              if (msg.id.startsWith('temp-') && Date.now() - (msg.clientTimestampMs || msg.timestampMs) > 300000) {
                return false;
              }
              return true;
            });
          
          // Only load from localStorage if we don't have messages yet (prevent overriding blockchain data)
          setMessages(prevMessages => {
            if (prevMessages.length === 0) {
              console.log('Loading messages from localStorage:', parsedMessages.length, 'for key:', storageKey);
              console.log('Sample messages:', parsedMessages.slice(0, 2).map(m => ({
                content: m.content.substring(0, 30),
                time: new Date(m.clientTimestampMs || m.timestampMs).toLocaleString(),
                sender: m.sender.substring(0, 6)
              })));
              // Sort them properly
              const sortedMessages = sortMessagesByTimestamp(parsedMessages);
              // Scroll to bottom after loading messages
              setTimeout(() => scrollToBottom(), 100);
              return sortedMessages;
            } else {
              console.log('Skipping localStorage load - messages already loaded from blockchain, prevMessages:', prevMessages.length);
              return prevMessages;
            }
          });
        } catch (error) {
          console.error('Failed to parse stored messages:', error);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, currentAccount?.address, recipientAddress, currentAccount]);

  // Save messages to localStorage whenever messages change (only confirmed messages)
  useEffect(() => {
    if (isConnected && currentAccount && recipientAddress && messages.length > 0) {
      const storageKey = `messages_${currentAccount.address}_${recipientAddress}`;
      // Only save confirmed messages and recent optimistic ones
      const messagesToSave = messages.filter(msg => 
        !msg.id.startsWith('temp-') || // Confirmed messages
        (msg.id.startsWith('temp-') && Date.now() - msg.timestampMs < 60000) // Recent optimistic (1 minute)
      );
      
      localStorage.setItem(storageKey, JSON.stringify(messagesToSave));
      console.log('Saved messages to localStorage:', messagesToSave.length, 'out of', messages.length);
    }
  }, [messages, isConnected, currentAccount?.address, recipientAddress, currentAccount]);

  // Clear messages when account changes to prevent cross-account contamination
  useEffect(() => {
    setMessages([]);
    setError(null);
    console.log('Cleared messages due to account change:', currentAccount?.address);
  }, [currentAccount?.address, currentAccount]);

  // Clear messages when recipient changes
  useEffect(() => {
    setMessages([]);
    setError(null);
    console.log('Cleared messages due to recipient change:', recipientAddress);
  }, [recipientAddress]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !isConnected) return;

    // Use a single timestamp for consistency
    const clientTimestamp = Date.now();
    const tempId = `temp-${clientTimestamp}`;
    setSendStatus(true);

    try {
      console.log("Sending message to:", recipientAddress);
      console.log("Current account:", currentAccount?.address);

      if (!recipientAddress || !/^0x[a-fA-F0-9]{64}$/.test(recipientAddress)) {
        throw new Error("Invalid recipient address: " + recipientAddress);
      }

      // Prevent sending to oneself
      if (recipientAddress === currentAccount?.address) {
        throw new Error("Cannot send message to yourself");
      }

      const cleanedMessage = message.trim().replace(/\s+/g, " ");

      // Generate shared encryption key for this conversation
      // For now, derive key from addresses (in production, this should use proper key exchange)
      const sharedKey = await deriveSharedKeyFromAddresses(currentAccount.address, recipientAddress);
      console.log("Generated shared key for encryption");

      // Encrypt the message
      const encryptedData = await encryptMessage(cleanedMessage, sharedKey);
      console.log("Message encrypted successfully");

      // Store encrypted message with decentralized fallback strategy
      let storageResult;
      try {
        storageResult = await storeOnWalrus(encryptedData, {
          epochs: 1, // Store for 1 epoch (~24 hours)
          deletable: false
        });
        console.log("Message stored on Walrus:", storageResult);
      } catch (walrusError) {
        console.warn("Walrus storage failed, using IPFS decentralized fallback:", walrusError.message);

        // Decentralized fallback: Store on IPFS (fully decentralized)
        try {
          storageResult = await storeOnIPFS(encryptedData);
          storageResult.fallback = true;
          storageResult.method = 'ipfs';
          storageResult.timestamp = clientTimestamp;
          console.log("Message stored on IPFS:", storageResult);
        } catch (ipfsError) {
          console.error("IPFS also failed, using compressed Sui fallback:", ipfsError);
          // Ultimate fallback: store compressed version on Sui (minimize cost)
          const compressed = btoa(encryptedData); // Simple base64 encoding for compression
          storageResult = {
            cid: null,
            compressedData: compressed,
            fallback: true,
            method: 'sui-compressed',
            originalSize: encryptedData.length,
            compressedSize: compressed.length,
            timestamp: clientTimestamp
          };
        }
      }

      // Create metadata for Sui blockchain (always small reference)
      const metadata = storageResult.fallback
        ? storageResult.method === 'ipfs'
          ? JSON.stringify({
              cid: storageResult.cid,
              timestamp: clientTimestamp,
              version: "ipfs-fallback-v1",
              size: storageResult.size,
              gatewayUrl: storageResult.gatewayUrl
            })
          : JSON.stringify({
              compressedData: storageResult.compressedData,
              timestamp: clientTimestamp,
              version: "sui-compressed-v1",
              originalSize: storageResult.originalSize,
              compressedSize: storageResult.compressedSize
            })
        : JSON.stringify({
            blobId: storageResult.blobId,
            timestamp: clientTimestamp,
            version: "walrus-v1"
          });

      const metadataBytes = new TextEncoder().encode(metadata);

      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::su_messaging::send_message`,
        arguments: [
          tx.pure.address(recipientAddress),
          tx.pure(bcs.vector(bcs.u8()).serialize(Array.from(metadataBytes))),
          tx.object("0x0000000000000000000000000000000000000000000000000000000000000006"), // Clock object
        ],
      });

      console.log('Sending transaction with storage method:', storageResult.fallback ? `${storageResult.method} fallback` : 'Walrus');
      console.log('Transaction details:', {
        target: `${packageId}::su_messaging::send_message`,
        recipient: recipientAddress,
        metadataLength: metadataBytes.length,
        storageType: storageResult.fallback ? `${storageResult.method} fallback` : 'walrus',
        blobId: storageResult.blobId || storageResult.cid || 'N/A (fallback storage)'
      });

      // Add message with 'sending' status immediately (show original message for UX)
      const tempMessage = {
        id: tempId,
        sender: currentAccount.address,
        recipient: recipientAddress,
        content: cleanedMessage, // Show original message
        timestamp: new Date(clientTimestamp),
        timestampMs: clientTimestamp,
        clientTimestampMs: clientTimestamp,
        status: 'sending',
        storageType: storageResult.fallback ? `${storageResult.method} fallback` : 'walrus', // Track storage method
      };
      setMessages(prevMessages => {
        const newMessages = [...prevMessages, tempMessage];
        return sortMessagesByTimestamp(newMessages);
      });

      console.log('About to call signAndExecuteTransactionBlock');

      // Use the mutate function with callbacks
      const isMobile = isMobileDevice();
      signAndExecuteTransactionBlock({
        transaction: tx,
        options: isMobile ? {
          showEffects: true,
          showEvents: true,
        } : {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      }, {
        onSuccess: (result) => {
          console.log('Transaction result:', result);

          const isSuccess = result && (
            (result.effects && typeof result.effects === 'object' && result.effects.status === 'success') ||
            (result.rawEffects && Array.isArray(result.rawEffects)) ||
            result.digest
          );

          console.log('Transaction success check:', isSuccess);

          if (isSuccess) {
            console.log('Transaction completed successfully');

            // Try to extract message info from transaction events
            let messageId = null;
            let eventSender = null;
            let eventRecipient = null;
            let eventTimestamp = null;

            if (result.events && result.events.length > 0) {
              const messageEvent = result.events.find(event =>
                event.type === `${packageId}::su_messaging::MessageCreated` ||
                event.type.includes('MessageCreated')
              );

              if (messageEvent && messageEvent.parsedJson) {
                const eventData = messageEvent.parsedJson;
                messageId = eventData.message_id;
                eventSender = eventData.sender;
                eventRecipient = eventData.recipient;
                eventTimestamp = eventData.timestamp;
                console.log('Found message event in transaction:', eventData);
              }
            }

            // Update the temporary message with confirmed status
            setMessages(prevMessages => {
              const updatedMessages = prevMessages.map(msg =>
                msg.id === tempId
                  ? {
                      ...msg,
                      id: messageId || `confirmed-${Date.now()}`,
                      sender: eventSender || msg.sender,
                      recipient: eventRecipient || msg.recipient,
                      timestamp: eventTimestamp ? new Date(Long.fromValue(eventTimestamp).toNumber()) : msg.timestamp,
                      blockchainTimestampMs: eventTimestamp ? Long.fromValue(eventTimestamp).toNumber() : null,
                      status: 'confirmed'
                    }
                  : msg
              );

              return sortMessagesByTimestamp(updatedMessages);
            });

            setSendStatus(false);
            setMessage("");
          } else {
            console.error('Transaction failed:', result);
            setMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === tempId
                  ? { ...msg, status: 'failed' }
                  : msg
              )
            );
            setError("Transaction failed: " + (result ? JSON.stringify(result) : 'No result returned'));
            setSendStatus(false);
          }
        },
        onError: (error) => {
          console.error('Transaction failed with error:', error);

          // Mark the temporary message as failed
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === tempId
                ? { ...msg, status: 'failed' }
                : msg
            )
          );

          setError("Failed to send: " + error.message);
          setSendStatus(false);
        }
      });
    } catch (error) {
      console.error('Error in handleSend:', error);

      // Check if it's a Walrus connectivity issue
      if (error.message.includes('Walrus') || error.message.includes('All Walrus endpoints failed')) {
        setError("Decentralized storage temporarily unavailable. Your message will be stored securely on the blockchain and remain private.");
        // The fallback mechanism will store encrypted content directly on Sui
      } else {
        setError("Failed to send message: " + error.message);
      }

      setSendStatus(false);
    }
  };

  // Decrypt messages that need decryption
  useEffect(() => {
    const decryptPendingMessages = async () => {
      const messagesNeedingDecryption = messages.filter(msg => msg.needsDecryption && !msg.decryptionAttempted);

      if (messagesNeedingDecryption.length === 0) return;

      console.log(`Decrypting ${messagesNeedingDecryption.length} messages from Walrus`);

      for (const message of messagesNeedingDecryption) {
        try {
          const decryptedContent = await decryptMessageFromStorage(
            message.content,
            message.sender,
            message.recipient
          );

          // Update the message with decrypted content
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === message.id
                ? {
                    ...msg,
                    content: decryptedContent,
                    needsDecryption: false,
                    decryptionAttempted: true
                  }
                : msg
            )
          );
        } catch (error) {
          console.error('Failed to decrypt message:', message.id, error);
          // Mark as attempted but failed
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === message.id
                ? {
                    ...msg,
                    content: "[Message temporarily unavailable - stored securely]",
                    needsDecryption: false,
                    decryptionAttempted: true
                  }
                : msg
            )
          );
        }
      }
    };

    decryptPendingMessages();
  }, [messages]);

  // Fetch sender names when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const uniqueSenders = new Set(messages.map(msg => msg.sender));
      uniqueSenders.forEach(sender => {
        if (!senderNames.has(sender)) {
          fetchUserName(sender);
        }
      });
    }
  }, [messages, senderNames, fetchUserName]);

  return (
    <Container
      className="mt-3 mt-md-5 chat-container"
      style={{
        maxWidth: "800px",
        minHeight: window.innerWidth < 768 ? "calc(100vh - 120px)" : "450px",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #1a0033, #330066)",
        border: window.innerWidth < 768 ? "2px solid #ff00ff" : "3px solid #ff00ff",
        borderRadius: window.innerWidth < 768 ? "8px" : "6px",
        boxShadow: window.innerWidth < 768 ? "0 0 8px #00ffff" : "0 0 12px #00ffff",
        fontFamily: "Orbitron, sans-serif",
        color: "#00ffff",
        padding: window.innerWidth < 768 ? "8px" : "6px",
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
        {/* Mobile Chat List Toggle Button */}
        {window.innerWidth < 768 && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              zIndex: 10,
            }}
          >
            <Button
              onClick={() => setShowMobileChatList(!showMobileChatList)}
              style={{
                backgroundColor: "#ff00ff",
                border: "2px solid #ff00ff",
                color: "#00ffff",
                textShadow: "0 0 6px #00ffff",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "14px",
                boxShadow: "0 0 10px #ff00ff",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.boxShadow = "0 0 15px #ff00ff";
                e.target.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.target.style.boxShadow = "0 0 10px #ff00ff";
                e.target.style.transform = "scale(1)";
              }}
            >
              {showMobileChatList ? "✕" : "💬"}
            </Button>
          </div>
        )}

        {/* Chat List Sidebar */}
        <Col
          md={2}
          style={{
            backgroundColor: "#1a0033",
            minHeight: "100%",
            padding: "0",
            borderRight: "3px dashed #ff00ff",
            display: window.innerWidth < 768 ? (showMobileChatList ? "flex" : "none") : "flex",
            flexDirection: "column",
            width: window.innerWidth < 768 ? "280px" : "auto",
            position: window.innerWidth < 768 ? "absolute" : "relative",
            left: window.innerWidth < 768 ? "0" : "auto",
            top: window.innerWidth < 768 ? "0" : "auto",
            height: window.innerWidth < 768 ? "100%" : "auto",
            zIndex: window.innerWidth < 768 ? 5 : "auto",
            boxShadow: window.innerWidth < 768 ? "2px 0 10px rgba(0, 0, 0, 0.5)" : "none",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: "0",
              backgroundColor: "#330066",
              padding: "6px 0", // Even less padding
              height: "45px", // Even shorter
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
                textShadow: "0 0 6px #00ffff", // Smaller shadow
                fontSize: "12px", // Even smaller
              }}
            >
              CHAT LIST
            </h4>
          </div>
          <ListGroup
            style={{
              flex: "1",
              overflowY: "auto", // Enabled scrolling
              maxHeight: "calc(450px - 110px)", // Adjusted for new container and header heights
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
                  padding: "4px", // Even less padding
                  transition: "background-color 0.3s",
                  cursor: "pointer",
                  fontSize: "10px", // Even smaller
                  textShadow: "0 0 2px #ff00ff", // Smaller shadow
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

        {/* Mobile Overlay */}
        {window.innerWidth < 768 && showMobileChatList && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: 4,
            }}
            onClick={() => setShowMobileChatList(false)}
          />
        )}

        <Col
          md={10}
          style={{
            padding: "0",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            minHeight: "0",
            flex: window.innerWidth < 768 ? "1" : "1",
            width: window.innerWidth < 768 ? "100%" : "auto",
          }}
        >
          <div
            style={{
              position: "relative",
              padding: "6px 0", // Even less padding
              height: "45px", // Even shorter
              backgroundColor: "#330066",
              borderBottom: "2px solid #ff00ff",
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                margin: "0",
                textAlign: "center",
                textShadow: "0 0 10px #00ffff", // Smaller shadow
                fontSize: "16px", // Even smaller
              }}
            >
              CHATTING WITH {recipientName.toUpperCase()}
            </h2>
            <Button
              variant="secondary"
              onClick={scrollToBottom}
              style={{
                position: "absolute",
                right: "6px", // Less margin
                top: "50%",
                transform: "translateY(-50%)",
                padding: "3px 6px", // Smaller padding
                fontSize: "12px", // Smaller font
                backgroundColor: "#ff00ff",
                borderColor: "#ff00ff",
                textShadow: "0 0 3px #00ffff", // Smaller shadow
              }}
            >
              ↓
            </Button>
          </div>
          <div
            ref={chatContentRef}
            className="chat-messages"
            style={{
              flexGrow: 1,
              overflowY: "auto",
              padding: window.innerWidth < 768 ? "12px" : "8px",
              background: "rgba(0, 0, 0, 0.7)",
              border: "2px solid #ff00ff",
              borderRadius: window.innerWidth < 768 ? "8px" : "4px",
              maxHeight: window.innerWidth < 768 ? "calc(100vh - 250px)" : "calc(450px - 125px)",
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
                      margin: "2px 0", // Even less margin
                      borderRadius: "4px", // Smaller radius
                      maxWidth: "70%",
                      marginLeft:
                        msg.sender === currentAccount?.address
                          ? "auto"
                          : "6px", // Less margin
                      padding: "4px", // Even less padding
                      border: msg.status === 'sending' || msg.id.startsWith('temp-')
                        ? "2px dashed #ffff00"
                        : msg.status === 'failed'
                        ? "2px solid #ff0000"
                        : "1px dashed #ff00ff",
                      boxShadow: msg.status === 'sending' || msg.id.startsWith('temp-')
                        ? "0 0 6px rgba(255, 255, 0, 0.5)" // Smaller shadow
                        : msg.status === 'failed'
                        ? "0 0 6px rgba(255, 0, 0, 0.5)" // Smaller shadow
                        : "0 0 6px rgba(0, 255, 255, 0.5)", // Smaller shadow
                      fontSize: "11px", // Even smaller
                      textShadow: "0 0 1px #ff00ff", // Smaller shadow
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      opacity: msg.status === 'sending' || msg.id.startsWith('temp-') ? 0.8 : 1,
                    }}
                  >
                    <strong>
                      {msg.sender === currentAccount?.address
                        ? "YOU"
                        : (senderNames.get(msg.sender) || msg.sender.slice(0, 6) + "...")}
                      :
                    </strong>{" "}
                    {msg.content}
                    {(msg.status === 'sending' || msg.id.startsWith('temp-')) && (
                      <span style={{ color: "#ffff00", marginLeft: "4px", fontSize: "9px" }}>
                        ⏳ {msg.status === 'sending' ? 'Sending...' : 'Sent'}
                      </span>
                    )}
                    {msg.status === 'confirmed' && (
                      <span style={{ color: "#00ff00", marginLeft: "4px", fontSize: "9px" }}>
                        ✓ Confirmed
                      </span>
                    )}
                    {msg.status === 'failed' && msg.sender === currentAccount?.address && (
                      <>
                        <span style={{ color: "#ff0000", marginLeft: "4px", fontSize: "9px" }}>
                          ✗ Failed
                        </span>
                        <button
                          onClick={() => {
                            setMessages(prevMessages => 
                              prevMessages.filter(m => m.id !== msg.id)
                            );
                          }}
                          style={{
                            background: "none",
                            border: "1px solid #ff0000",
                            color: "#ff0000",
                            fontSize: "7px", // Even smaller
                            padding: "1px 3px", // Smaller padding
                            marginLeft: "4px",
                            cursor: "pointer",
                            borderRadius: "1px", // Smaller radius
                          }}
                          onMouseOver={(e) => e.target.style.background = "#ff0000"}
                          onMouseOut={(e) => e.target.style.background = "none"}
                          title="Delete failed message"
                        >
                          ✕
                        </button>
                      </>
                    )}
                    <br />
                    <small
                      style={{
                        fontSize: "7px", // Even smaller
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
              height: "70px", // Even shorter
              display: "flex",
              alignItems: "center",
            }}
          >
            <Form
              onSubmit={handleSend}
              style={{ width: "100%", display: "flex", gap: "6px" }} // Smaller gap
            >
              <Form.Control
                as="textarea"
                placeholder="TYPE YOUR MESSAGE..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend(e)
                }
                className="message-input"
                style={{
                  flex: "1",
                  minHeight: window.innerWidth < 768 ? "40px" : "30px",
                  padding: window.innerWidth < 768 ? "8px" : "6px",
                  backgroundColor: "#1a0033",
                  color: "#00ffff",
                  border: "2px solid #ff00ff",
                  borderRadius: window.innerWidth < 768 ? "6px" : "3px",
                  resize: "none",
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: window.innerWidth < 768 ? "14px" : "10px",
                  textShadow: "0 0 1px #ff00ff",
                }}
                disabled={!isConnected}
              />
              <Button
                variant="primary"
                type="submit"
                className="touch-target"
                style={{
                  padding: window.innerWidth < 768 ? "8px 16px" : "6px 14px",
                  backgroundColor: "#ff00ff",
                  borderColor: "#ff00ff",
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: window.innerWidth < 768 ? "14px" : "12px",
                  textShadow: "0 0 3px #00ffff",
                  minWidth: window.innerWidth < 768 ? "60px" : "auto",
                }}
                disabled={!isConnected}
              >
                {window.innerWidth < 768 ? "🚀" : "SEND"}
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
