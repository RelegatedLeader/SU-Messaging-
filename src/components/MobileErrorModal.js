import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { getMobileErrorMessage, getMobileSuccessMessage } from '../utils/mobileWallet';

const MobileErrorModal = ({
  show,
  onHide,
  type,
  error,
  walletType = 'Sui Wallet',
  onRetry,
  isSuccess = false
}) => {
  const errorInfo = isSuccess
    ? getMobileSuccessMessage(type)
    : getMobileErrorMessage(error, walletType);

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="sm"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(5px)'
      }}
    >
      <Modal.Header
        style={{
          background: isSuccess ? '#003300' : '#330000',
          borderBottom: `2px solid ${isSuccess ? '#00ff00' : '#ff0000'}`,
          color: isSuccess ? '#00ff00' : '#ff0000',
          fontFamily: 'Orbitron, sans-serif',
          padding: '15px',
          textAlign: 'center'
        }}
      >
        <Modal.Title style={{
          fontSize: '1.1rem',
          textShadow: `0 0 6px ${isSuccess ? '#00ff00' : '#ff0000'}`
        }}>
          {isSuccess ? '✅' : '❌'} {errorInfo.title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body
        style={{
          background: '#1a0033',
          color: '#00ffff',
          textShadow: '0 0 3px #ff00ff',
          padding: '20px',
          textAlign: 'center',
          fontSize: '0.95rem'
        }}
      >
        <p style={{ marginBottom: '20px', lineHeight: '1.4' }}>
          {errorInfo.message}
        </p>
        {error && (
          <details style={{
            marginTop: '15px',
            textAlign: 'left',
            fontSize: '0.8rem',
            color: '#ffffff'
          }}>
            <summary style={{ cursor: 'pointer', marginBottom: '5px' }}>
              Technical Details
            </summary>
            <code style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '8px',
              borderRadius: '4px',
              display: 'block',
              wordBreak: 'break-word'
            }}>
              {error.message || error.toString()}
            </code>
          </details>
        )}
      </Modal.Body>
      <Modal.Footer
        style={{
          background: 'linear-gradient(135deg, #1a0033, #440088)',
          borderTop: `2px solid ${isSuccess ? '#00ff00' : '#ff0000'}`,
          justifyContent: 'center',
          padding: '15px'
        }}
      >
        <Button
          onClick={onRetry || onHide}
          style={{
            backgroundColor: isSuccess ? '#00ff00' : '#ff00ff',
            borderColor: isSuccess ? '#00ff00' : '#ff00ff',
            color: isSuccess ? '#000000' : '#ffffff',
            textShadow: `0 0 3px ${isSuccess ? '#ffffff' : '#00ffff'}`,
            padding: '10px 20px',
            fontSize: '1rem',
            borderRadius: '8px',
            fontWeight: 'bold',
            minWidth: '120px',
            touchAction: 'manipulation'
          }}
        >
          {isSuccess ? 'Continue' : errorInfo.action}
        </Button>
        {!isSuccess && (
          <Button
            variant="secondary"
            onClick={onHide}
            style={{
              marginLeft: '10px',
              backgroundColor: 'transparent',
              borderColor: '#666666',
              color: '#666666',
              padding: '10px 15px'
            }}
          >
            Close
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default MobileErrorModal;