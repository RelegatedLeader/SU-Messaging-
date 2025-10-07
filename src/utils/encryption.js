import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { sha256 } from '@noble/hashes/sha256';

/**
 * Encryption utilities for SU Messaging
 * Provides end-to-end encryption using AES-256-GCM via Web Crypto API and key exchange
 */

// Generate a new key pair for a user
export function generateKeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
    secretKey: naclUtil.encodeBase64(keyPair.secretKey)
  };
}

// Derive shared secret from sender's secret key and recipient's public key
export function deriveSharedKey(mySecretKey, theirPublicKey) {
  const mySecret = naclUtil.decodeBase64(mySecretKey);
  const theirPublic = naclUtil.decodeBase64(theirPublicKey);

  const sharedSecret = nacl.box.before(theirPublic, mySecret);

  // Use SHA-256 to derive a 32-byte key for AES-256
  const keyData = sha256(sharedSecret);

  // Return as base64
  return btoa(String.fromCharCode(...keyData));
}

// Encrypt a message using AES-256-GCM via Web Crypto API
export async function encryptMessage(message, sharedKey) {
  try {
    // sharedKey should be a Uint8Array (32 bytes for AES-256)
    let keyData;
    if (sharedKey instanceof Uint8Array) {
      keyData = sharedKey;
    } else {
      // Fallback for string keys - convert to bytes
      keyData = new TextEncoder().encode(sharedKey);
      // Ensure it's exactly 32 bytes by hashing if necessary
      if (keyData.length !== 32) {
        keyData = new Uint8Array(await crypto.subtle.digest('SHA-256', keyData));
      }
    }

    // Import the key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Generate a random 96-bit (12-byte) IV for GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the message
    const messageData = new TextEncoder().encode(message);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      messageData
    );

    // Combine IV and encrypted data
    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    // Return as base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message: ' + error.message);
  }
}

// Decrypt a message using AES-256-GCM via Web Crypto API
export async function decryptMessage(encryptedData, sharedKey) {
  try {
    // Convert base64 to Uint8Array
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // sharedKey should be a Uint8Array (32 bytes for AES-256)
    let keyData;
    if (sharedKey instanceof Uint8Array) {
      keyData = sharedKey;
    } else {
      // Fallback for string keys - convert to bytes
      keyData = new TextEncoder().encode(sharedKey);
      // Ensure it's exactly 32 bytes by hashing if necessary
      if (keyData.length !== 32) {
        keyData = new Uint8Array(await crypto.subtle.digest('SHA-256', keyData));
      }
    }

    // Import the key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt the message
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      encrypted
    );

    // Return as string
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message: ' + error.message);
  }
}

// Generate a conversation key from two addresses (deterministic)
export function generateConversationKey(address1, address2) {
  // Sort addresses to ensure consistency
  const [addr1, addr2] = [address1, address2].sort();

  // Create a deterministic key from both addresses
  const combined = addr1 + addr2 + 'su-messaging-conversation-salt';
  const hash = sha256(combined);

  // Convert to base64 for compatibility
  return btoa(String.fromCharCode(...hash));
}

// Encrypt file data
export async function encryptFile(fileData, sharedKey) {
  try {
    // Convert the shared key string to Uint8Array
    const keyData = new TextEncoder().encode(sharedKey);

    // Import the key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Generate a random 96-bit (12-byte) IV for GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the file data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      fileData
    );

    // Combine IV and encrypted data
    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    // Return as base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('File encryption error:', error);
    throw new Error('Failed to encrypt file: ' + error.message);
  }
}

// Decrypt file data
export async function decryptFile(encryptedData, sharedKey) {
  try {
    // Convert base64 to Uint8Array
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Convert the shared key string to Uint8Array
    const keyData = new TextEncoder().encode(sharedKey);

    // Import the key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt the file data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      encrypted
    );

    return new Uint8Array(decrypted);
  } catch (error) {
    console.error('File decryption error:', error);
    throw new Error('Failed to decrypt file: ' + error.message);
  }
}

// Hash function for message integrity
export function hashMessage(message) {
  return sha256(message);
}

// Verify message integrity
export function verifyMessageIntegrity(message, expectedHash) {
  const actualHash = hashMessage(message);
  return actualHash === expectedHash;
}