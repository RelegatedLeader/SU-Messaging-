// Mobile wallet utilities for SU Messaging
export const MOBILE_WALLETS = {
  SUI_WALLET: 'sui',
  SUIET: 'suiet',
  MORPHIS: 'morphis',
  NIGHTLY: 'nightly'
};

export const WALLET_APP_SCHEMES = {
  [MOBILE_WALLETS.SUI_WALLET]: {
    ios: 'sui-wallet://',
    android: 'intent://sui.com/wallet#Intent;scheme=sui-wallet;package=com.mystenlabs.suiwallet;end',
    fallback: 'https://sui.com/download'
  },
  [MOBILE_WALLETS.SUIET]: {
    ios: 'suiet://',
    android: 'intent://suiet.app#Intent;scheme=suiet;package=app.suiet.wallet;end',
    fallback: 'https://suiet.app/download'
  }
};

// Detect if device is mobile
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth < 768;
};

// Detect mobile platform
export const getMobilePlatform = () => {
  const userAgent = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'unknown';
};

// Check if wallet app is installed (basic check)
export const isWalletAppInstalled = async (walletType) => {
  if (!isMobileDevice()) return false;

  const platform = getMobilePlatform();
  const scheme = WALLET_APP_SCHEMES[walletType]?.[platform];

  if (!scheme) return false;

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = scheme;

    const timeout = setTimeout(() => {
      document.body.removeChild(iframe);
      resolve(false); // App not installed or didn't respond
    }, 2000);

    iframe.onload = () => {
      clearTimeout(timeout);
      document.body.removeChild(iframe);
      resolve(true); // App responded
    };

    document.body.appendChild(iframe);
  });
};

// Redirect to wallet app for transaction signing
export const redirectToWalletForSigning = (walletType, transactionData) => {
  const platform = getMobilePlatform();
  const scheme = WALLET_APP_SCHEMES[walletType]?.[platform];

  if (scheme) {
    // For mobile, we need to encode the transaction data in the URL
    const transactionParam = encodeURIComponent(JSON.stringify(transactionData));
    const redirectUrl = `${scheme}?transaction=${transactionParam}&callback=${encodeURIComponent(window.location.href)}`;

    // Try to open the app
    window.location.href = redirectUrl;

    // Fallback after a delay
    setTimeout(() => {
      const fallback = WALLET_APP_SCHEMES[walletType]?.fallback;
      if (fallback) {
        window.location.href = fallback;
      }
    }, 2000);
  }
};

// Handle mobile wallet connection - simplified to work with dapp-kit
export const handleMobileWalletConnection = async (walletType) => {
  // This function is now mainly for error handling and fallbacks
  // The actual connection is handled by dapp-kit's useConnectWallet hook
  // which will automatically redirect to mobile wallet apps when needed

  if (walletType === MOBILE_WALLETS.SUI_WALLET) {
    // For Sui Wallet (Slush), we trust dapp-kit to handle the connection
    // If the wallet app is not installed, dapp-kit will show appropriate errors
    // The connection will redirect to the app automatically on mobile
    return Promise.resolve();
  }

  // For other wallets, we could add specific handling if needed
  return Promise.resolve();
};

// Get recommended mobile wallet for platform
export const getRecommendedMobileWallet = () => {
  const platform = getMobilePlatform();

  if (platform === 'ios') {
    return MOBILE_WALLETS.SUI_WALLET; // Sui Wallet is recommended for iOS
  } else if (platform === 'android') {
    return MOBILE_WALLETS.SUI_WALLET; // Sui Wallet for Android
  }

  return MOBILE_WALLETS.SUI_WALLET; // Default fallback
};

// Check if we should use mobile-optimized flow
export const shouldUseMobileFlow = () => {
  return isMobileDevice() && !window.ethereum; // No browser extension wallet
};

// Mobile error handling utilities
export const MOBILE_ERRORS = {
  WALLET_NOT_INSTALLED: 'WALLET_NOT_INSTALLED',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TRANSACTION_REJECTED: 'TRANSACTION_REJECTED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT'
};

export const getMobileErrorMessage = (errorType, walletType = 'wallet') => {
  const messages = {
    [MOBILE_ERRORS.WALLET_NOT_INSTALLED]: {
      title: 'Wallet App Not Found',
      message: `${walletType} app is not installed on your device. Please install it from the app store and try again.`,
      action: 'Install Wallet'
    },
    [MOBILE_ERRORS.CONNECTION_FAILED]: {
      title: 'Connection Failed',
      message: `Unable to connect to ${walletType}. Make sure the app is installed and try again. If you're on mobile, you'll be redirected to sign in.`,
      action: 'Retry Connection'
    },
    [MOBILE_ERRORS.TRANSACTION_REJECTED]: {
      title: 'Sign In Cancelled',
      message: 'You cancelled the sign in request. Please try connecting again to access SU Messaging.',
      action: 'Try Again'
    },
    [MOBILE_ERRORS.NETWORK_ERROR]: {
      title: 'Network Error',
      message: 'Unable to connect to the blockchain network. Please check your internet connection and try again.',
      action: 'Retry'
    },
    [MOBILE_ERRORS.TIMEOUT]: {
      title: 'Connection Timeout',
      message: 'The connection to your wallet timed out. Please try again.',
      action: 'Retry'
    }
  };

  return messages[errorType] || {
    title: 'Unknown Error',
    message: 'An unexpected error occurred. Please try again.',
    action: 'Retry'
  };
};

// Detect common mobile wallet errors
export const parseMobileError = (error) => {
  const errorMessage = error?.message?.toLowerCase() || '';

  if (errorMessage.includes('user rejected') || errorMessage.includes('rejected')) {
    return MOBILE_ERRORS.TRANSACTION_REJECTED;
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return MOBILE_ERRORS.TIMEOUT;
  }

  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return MOBILE_ERRORS.NETWORK_ERROR;
  }

  if (errorMessage.includes('not found') || errorMessage.includes('not installed')) {
    return MOBILE_ERRORS.WALLET_NOT_INSTALLED;
  }

  return MOBILE_ERRORS.CONNECTION_FAILED;
};

// Mobile success messages
export const getMobileSuccessMessage = (action) => {
  const messages = {
    connection: {
      title: 'Connected Successfully',
      message: 'Your wallet is now connected. You can start using SU Messaging!'
    },
    transaction: {
      title: 'Transaction Successful',
      message: 'Your transaction has been confirmed on the blockchain.'
    },
    registration: {
      title: 'Registration Complete',
      message: 'You are now registered and can set your display name.'
    }
  };

  return messages[action] || {
    title: 'Success',
    message: 'Operation completed successfully.'
  };
};