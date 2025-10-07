# SU Messaging - Decentralized Encrypted Chat

A secure, decentralized messaging application built on Sui blockchain with end-to-end encryption and multi-layered storage fallbacks.

## Features

- 🔐 **End-to-End Encryption**: AES-256-GCM encryption with deterministic key derivation
- 🌊 **Decentralized Storage**: Multi-tier storage with Walrus, IPFS, and Sui blockchain fallbacks
- ⛓️ **Blockchain Integration**: Message metadata stored on Sui blockchain for immutability
- 💰 **Cost-Optimized**: Smart storage hierarchy minimizes blockchain storage costs
- 🔄 **Reliable Delivery**: Automatic failover between storage providers
- 📱 **Mobile-Friendly**: Responsive design with wallet integration

## Architecture

### Storage Hierarchy (Cost-Optimized)
1. **Walrus Storage** (~$0.001) - Primary decentralized blob storage
2. **IPFS Fallback** - Secondary decentralized storage via Infura
3. **Compressed Sui** - Ultimate fallback with data compression to minimize costs

### Security Model
- Messages are encrypted client-side before storage
- Shared keys derived deterministically from wallet addresses
- No plaintext ever touches centralized servers
- Metadata-only storage on blockchain (small, cheap references)

## Setup

### Prerequisites
- Node.js 16+
- Sui wallet (e.g., Sui Wallet extension)
- Infura account for IPFS (optional, for fallback storage)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd SU-MESSAGING
```

2. Install dependencies:
```bash
npm install
```

3. Configure IPFS (optional but recommended):
```bash
cp .env.example .env
# Edit .env with your Infura credentials
```

4. Start the development server:
```bash
npm start
```

### IPFS Configuration

Create a `.env` file with your Infura credentials:

```env
REACT_APP_INFURA_PROJECT_ID=your-project-id
REACT_APP_INFURA_PROJECT_SECRET=your-project-secret
```

Get free credentials at [Infura.io](https://infura.io/).

## Usage

1. Connect your Sui wallet
2. Enter a recipient's wallet address
3. Start chatting securely!

Messages are automatically encrypted and stored across decentralized networks.

## Cost Optimization

The system intelligently routes messages to minimize costs:

- **Short messages**: Walrus storage (~$0.001)
- **When Walrus fails**: IPFS decentralized storage
- **Emergency fallback**: Compressed storage on Sui blockchain

This ensures reliability while keeping costs low for long conversations.

## Security

- Client-side encryption only
- No message content stored unencrypted
- Deterministic key derivation from wallet addresses
- Decentralized storage prevents single points of failure

## Development

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

### Project Structure

```
src/
├── components/
│   ├── Chat.js          # Main chat interface
│   ├── Dashboard.js     # User dashboard
│   └── Settings.js      # App settings
├── utils/
│   ├── encryption.js    # AES-256-GCM encryption
│   ├── walrus.js        # Walrus storage integration
│   └── ipfs.js          # IPFS decentralized storage
└── ...
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
