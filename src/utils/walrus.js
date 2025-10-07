/**
 * Walrus Storage Utilities for SU Messaging
 * Handles blob storage and retrieval from Walrus network
 */

// Walrus testnet endpoints (try current working endpoints)
const WALRUS_ENDPOINTS = [
  {
    aggregator: 'https://walrus-testnet-aggregator.staketab.org',
    publisher: 'https://walrus-testnet-publisher.staketab.org'
  },
  {
    aggregator: 'https://walrus-testnet-aggregator.nodes.guru',
    publisher: 'https://walrus-testnet-publisher.nodes.guru'
  },
  {
    aggregator: 'https://aggregator.testnet.sui.io',
    publisher: 'https://publisher.testnet.sui.io'
  },
  {
    aggregator: 'https://walrus-testnet-aggregator.bdnodes.net',
    publisher: 'https://walrus-testnet-publisher.bdnodes.net'
  }
];

// Use the first endpoint as default, but try others if it fails
let currentEndpointIndex = 0;
const getCurrentEndpoints = () => WALRUS_ENDPOINTS[currentEndpointIndex];

/**
 * Store encrypted data on Walrus
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {Object} options - Storage options
 * @returns {Promise<Object>} - Walrus blob info with ID and metadata
 */
export async function storeOnWalrus(encryptedData, options = {}) {
  const errors = [];

  // Try each endpoint until one works
  for (let i = 0; i < WALRUS_ENDPOINTS.length; i++) {
    currentEndpointIndex = i;
    const endpoints = getCurrentEndpoints();

    try {
      console.log(`Trying Walrus endpoint ${i + 1}/${WALRUS_ENDPOINTS.length}: ${endpoints.publisher}`);

      const epochs = options.epochs || 1; // How many epochs to store
      const deletable = options.deletable || false;

      // Convert base64 to blob
      const binaryData = atob(encryptedData);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([bytes]);

      // Create form data for upload
      const formData = new FormData();
      formData.append('file', blob);

      const url = `${endpoints.publisher}/v1/store?epochs=${epochs}${deletable ? '&deletable=true' : ''}`;

      const response = await fetch(url, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Walrus storage failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      console.log('Walrus storage successful:', result);

      return {
        blobId: result.blobId || result.id,
        blobHash: result.blobHash || result.hash,
        size: bytes.length,
        epochs: epochs,
        deletable: deletable,
        timestamp: Date.now(),
        endpoint: endpoints.publisher
      };

    } catch (error) {
      console.warn(`Walrus endpoint ${endpoints.publisher} failed:`, error.message);
      errors.push(`${endpoints.publisher}: ${error.message}`);

      // If this isn't the last endpoint, continue to the next one
      if (i < WALRUS_ENDPOINTS.length - 1) {
        continue;
      }
    }
  }

  // All endpoints failed
  throw new Error(`All Walrus endpoints failed: ${errors.join(', ')}`);
}

/**
 * Retrieve data from Walrus
 * @param {string} blobId - The blob ID to retrieve
 * @returns {Promise<string>} - Base64 encoded data
 */
export async function retrieveFromWalrus(blobId) {
  const errors = [];

  // Try each endpoint until one works
  for (let i = 0; i < WALRUS_ENDPOINTS.length; i++) {
    currentEndpointIndex = i;
    const endpoints = getCurrentEndpoints();

    try {
      console.log(`Trying Walrus retrieval endpoint ${i + 1}/${WALRUS_ENDPOINTS.length}: ${endpoints.aggregator}`);

      const url = `${endpoints.aggregator}/v1/${blobId}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Walrus retrieval failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }

      const base64Data = btoa(binary);

      console.log('Walrus retrieval successful for blob:', blobId);

      return base64Data;

    } catch (error) {
      console.warn(`Walrus retrieval endpoint ${endpoints.aggregator} failed:`, error.message);
      errors.push(`${endpoints.aggregator}: ${error.message}`);

      // If this isn't the last endpoint, continue to the next one
      if (i < WALRUS_ENDPOINTS.length - 1) {
        continue;
      }
    }
  }

  // All endpoints failed
  throw new Error(`All Walrus retrieval endpoints failed: ${errors.join(', ')}`);
}/**
 * Check if a blob exists on Walrus
 * @param {string} blobId - The blob ID to check
 * @returns {Promise<boolean>} - Whether the blob exists
 */
export async function checkBlobExists(blobId) {
  try {
    // Try the first endpoint for existence check
    const endpoints = WALRUS_ENDPOINTS[0];
    const url = `${endpoints.aggregator}/v1/${blobId}`;

    const response = await fetch(url, { method: 'HEAD' });

    return response.ok;

  } catch (error) {
    console.error('Blob existence check failed:', error);
    return false;
  }
}

/**
 * Get blob metadata from Walrus
 * @param {string} blobId - The blob ID
 * @returns {Promise<Object>} - Blob metadata
 */
export async function getBlobMetadata(blobId) {
  try {
    // Try the first endpoint for metadata check
    const endpoints = WALRUS_ENDPOINTS[0];
    const url = `${endpoints.aggregator}/v1/${blobId}`;

    const response = await fetch(url, { method: 'HEAD' });

    if (!response.ok) {
      throw new Error(`Blob not found: ${blobId}`);
    }

    return {
      exists: true,
      size: response.headers.get('content-length'),
      type: response.headers.get('content-type'),
      lastModified: response.headers.get('last-modified')
    };

  } catch (error) {
    console.error('Blob metadata retrieval failed:', error);
    return { exists: false, error: error.message };
  }
}

/**
 * Delete a blob from Walrus (if deletable)
 * @param {string} blobId - The blob ID to delete
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteFromWalrus(blobId) {
  try {
    // Try the first endpoint for deletion
    const endpoints = WALRUS_ENDPOINTS[0];
    const url = `${endpoints.publisher}/v1/${blobId}`;

    const response = await fetch(url, {
      method: 'DELETE'
    });

    return response.ok;

  } catch (error) {
    console.error('Walrus deletion error:', error);
    return false;
  }
}

/**
 * Batch store multiple items on Walrus
 * @param {Array} items - Array of {data, options} objects
 * @returns {Promise<Array>} - Array of storage results
 */
export async function batchStoreOnWalrus(items) {
  const results = [];

  for (const item of items) {
    try {
      const result = await storeOnWalrus(item.data, item.options);
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Batch retrieve multiple items from Walrus
 * @param {Array<string>} blobIds - Array of blob IDs
 * @returns {Promise<Array>} - Array of retrieval results
 */
export async function batchRetrieveFromWalrus(blobIds) {
  const results = [];

  for (const blobId of blobIds) {
    try {
      const data = await retrieveFromWalrus(blobId);
      results.push({ success: true, data, blobId });
    } catch (error) {
      results.push({ success: false, error: error.message, blobId });
    }
  }

  return results;
}