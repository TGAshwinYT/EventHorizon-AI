import os
import base64
import hashlib

SECRET_KEY = os.getenv("SMS_ENCRYPTION_KEY", "EventHorizonSecureDefaultKey123!@#")

def _generate_key_stream(length: int, salt: bytes) -> bytes:
    """
    Generates a secure pseudo-random key stream of specified length using hashlib SHA-256
    to prevent simple database extractions from leaking raw numbers.
    """
    stream = b""
    counter = 0
    key_base = SECRET_KEY.encode('utf-8') + salt
    while len(stream) < length:
        h = hashlib.sha256(key_base + str(counter).encode('utf-8')).digest()
        stream += h
        counter += 1
    return stream[:length]

def encrypt_phone(phone: str) -> str:
    """
    Encrypts the plaintext phone number using a salt-derived SHA-256 XOR key stream.
    Returns a URL-safe base64 string.
    """
    if not phone:
        return ""
    try:
        # Standardize formatting - remove all non-digit/plus characters
        sanitized = "".join(c for c in phone if c.isdigit() or c == "+")
        if not sanitized:
            return ""
        
        # Use a random 8-byte salt
        salt = os.urandom(8)
        plain_bytes = sanitized.encode('utf-8')
        key_stream = _generate_key_stream(len(plain_bytes), salt)
        
        # Stream cipher encryption (XOR)
        cipher_bytes = bytes([b ^ k for b, k in zip(plain_bytes, key_stream)])
        
        # Store as salt (8 bytes) + cipher bytes
        combined = salt + cipher_bytes
        return base64.b64encode(combined).decode('utf-8')
    except Exception as e:
        print(f"[Crypto Error] Encryption failed: {e}")
        return ""

def decrypt_phone(encrypted_phone: str) -> str:
    """
    Decrypts the base64-encoded encrypted phone number back to plaintext.
    """
    if not encrypted_phone:
        return ""
    try:
        combined = base64.b64decode(encrypted_phone.encode('utf-8'))
        if len(combined) <= 8:
            return ""
        
        salt = combined[:8]
        cipher_bytes = combined[8:]
        key_stream = _generate_key_stream(len(cipher_bytes), salt)
        
        # Stream cipher decryption (XOR)
        plain_bytes = bytes([b ^ k for b, k in zip(cipher_bytes, key_stream)])
        return plain_bytes.decode('utf-8')
    except Exception as e:
        print(f"[Crypto Error] Decryption failed: {e}")
        return ""

def mask_phone_number(phone: str) -> str:
    """
    Masks intermediate characters of the phone number for client-side API safety
    (e.g., +91 9876543210 -> +91 ******3210).
    """
    if not phone:
        return ""
    
    # Strip spaces
    s = phone.strip()
    if len(s) <= 6:
        return "***"
    
    # Keep the first 3 characters (e.g. "+91") and last 4 characters, masking the rest
    first = s[:3]
    last = s[-4:]
    masked_length = max(1, len(s) - 7)
    return f"{first}{'*' * masked_length}{last}"
