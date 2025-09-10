#!/usr/bin/env python3
"""
Message Encryption Utilities
"""

import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import secrets
import os

class MessageEncryption:
    def __init__(self, master_key_path=None):
        """Initialize encryption with master key"""
        if master_key_path and os.path.exists(master_key_path):
            with open(master_key_path, 'rb') as f:
                self.master_key = f.read()
        else:
            # Fallback to environment variable
            env_key = os.getenv('MESSAGE_ENCRYPTION_KEY')
            if env_key:
                self.master_key = env_key.encode()
            else:
                raise ValueError("No encryption key found. Set MESSAGE_ENCRYPTION_KEY environment variable or provide master_key_path")
        
        self.cipher_suite = Fernet(self.master_key)
    
    def encrypt_message(self, content):
        """Encrypt message content"""
        if content is None:
            return None, None
        
        # Convert to string and handle empty content
        content_str = str(content) if content is not None else ""
        
        # Generate random IV
        iv = secrets.token_bytes(16)
        
        # Encrypt content
        encrypted_content = self.cipher_suite.encrypt(content_str.encode('utf-8'))
        
        return encrypted_content, iv
    
    def decrypt_message(self, encrypted_content, iv=None):
        """Decrypt message content"""
        if not encrypted_content:
            return None
        
        try:
            # Decrypt content
            decrypted_content = self.cipher_suite.decrypt(encrypted_content)
            return decrypted_content.decode('utf-8')
        except Exception as e:
            print(f"Decryption error: {e}")
            return None
    
    def generate_user_key(self, user_id, password):
        """Generate user-specific encryption key"""
        salt = f"user_{user_id}".encode()
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key

# Global encryption instance
try:
    message_encryption = MessageEncryption()
except ValueError:
    # Fallback for development/testing
    message_encryption = None
    print("Warning: Message encryption not initialized. Set MESSAGE_ENCRYPTION_KEY environment variable.") 