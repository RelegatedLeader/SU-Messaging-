// IPFS integration for decentralized storage fallback
// Uses Infura IPFS API for reliable decentralized storage

const IPFS_GATEWAYS = [
  'https://ipfs.infura.io:5001/api/v0',
  'https://gateway.pinata.cloud/ipfs',
  'https://cloudflare-ipfs.com/ipfs'
];

const IPFS_API_ENDPOINT = 'https://ipfs.infura.io:5001/api/v0';

// You'll need to set these in your environment or replace with your own
const INFURA_PROJECT_ID = process.env.REACT_APP_INFURA_PROJECT_ID || 'your-project-id';
const INFURA_PROJECT_SECRET = process.env.REACT_APP_INFURA_PROJECT_SECRET || 'your-project-secret';

/**
 * Store data on IPFS (decentralized fallback to Walrus)
 * @param {string} data - The data to store
 * @param {Object} options - Storage options
 * @returns {Promise<Object>} Storage result with CID
 */
export async function storeOnIPFS(data, options = {}) {
  try {
    // Convert string to blob for IPFS
    const blob = new Blob([data], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob);

    // Use Infura IPFS API
    const auth = btoa(`${INFURA_PROJECT_ID}:${INFURA_PROJECT_SECRET}`);
    const response = await fetch(`${IPFS_API_ENDPOINT}/add`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Data stored on IPFS:', result.Hash);

    return {
      cid: result.Hash,
      size: result.Size,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.Hash}`,
      method: 'ipfs'
    };
  } catch (error) {
    console.error('IPFS storage failed:', error);
    throw error;
  }
}

/**
 * Retrieve data from IPFS
 * @param {string} cid - The IPFS content identifier
 * @returns {Promise<string>} The retrieved data
 */
export async function retrieveFromIPFS(cid) {
  // Try multiple gateways for reliability
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const url = `${gateway}/${cid}`;
      console.log('Trying IPFS gateway:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Gateway ${gateway} failed: ${response.status}`);
      }

      const data = await response.text();
      console.log('Successfully retrieved from IPFS via', gateway);
      return data;
    } catch (error) {
      console.warn(`IPFS gateway ${gateway} failed:`, error.message);
      continue;
    }
  }

  throw new Error('All IPFS gateways failed to retrieve data');
}

/**
 * Check if IPFS is available
 * @returns {Promise<boolean>} Whether IPFS is accessible
 */
export async function isIPFSAvailable() {
  try {
    // Simple test to see if we can reach IPFS
    const response = await fetch('https://ipfs.infura.io:5001/api/v0/version', {
      headers: {
        'Authorization': `Basic ${btoa(`${INFURA_PROJECT_ID}:${INFURA_PROJECT_SECRET}`)}`,
      }
    });
    return response.ok;
  } catch (error) {
    console.warn('IPFS availability check failed:', error);
    return false;
  }
}