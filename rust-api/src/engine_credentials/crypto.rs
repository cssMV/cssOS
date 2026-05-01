//! AES-256-GCM helpers for the BYOK table.
//!
//! The master key is loaded once from `ENGINE_CRED_MASTER_KEY` (base64 32
//! bytes) into process memory; it never hits the DB. Ciphertext bytes stored
//! in `engine_credentials.encrypted_key` are laid out as:
//!
//!     [ 12-byte nonce ] [ GCM ciphertext + 16-byte tag ]
//!
//! Decryption rebuilds the cipher, splits off the nonce, and verifies the
//! tag in constant time (aes-gcm crate). We treat any failure as an
//! opaque error — caller decides whether to log or surface a generic
//! "credential unavailable".

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("master key not configured (ENGINE_CRED_MASTER_KEY unset)")]
    MasterKeyMissing,
    #[error("master key must decode to exactly 32 bytes (got {0})")]
    MasterKeySize(usize),
    #[error("master key base64 decode failed: {0}")]
    MasterKeyDecode(String),
    #[error("ciphertext too short — missing nonce")]
    CiphertextTooShort,
    #[error("aead operation failed")]
    AeadFailed,
}

/// Decoded 32-byte master key. Cheap to clone; hold a process-wide copy.
#[derive(Clone)]
pub struct MasterKey(Key<Aes256Gcm>);

impl MasterKey {
    /// Parse a base64-encoded 32-byte key. Empty string ⇒ MasterKeyMissing.
    pub fn from_base64(raw: &str) -> Result<Self, CryptoError> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(CryptoError::MasterKeyMissing);
        }
        let bytes = BASE64
            .decode(trimmed.as_bytes())
            .map_err(|e| CryptoError::MasterKeyDecode(e.to_string()))?;
        if bytes.len() != 32 {
            return Err(CryptoError::MasterKeySize(bytes.len()));
        }
        let key = Key::<Aes256Gcm>::clone_from_slice(&bytes);
        Ok(Self(key))
    }
}

/// Encrypt plaintext ⇒ `[nonce (12) || ciphertext+tag]`.
pub fn encrypt(master: &MasterKey, plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let cipher = Aes256Gcm::new(&master.0);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ct = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|_| CryptoError::AeadFailed)?;
    let mut out = Vec::with_capacity(12 + ct.len());
    out.extend_from_slice(nonce.as_slice());
    out.extend_from_slice(&ct);
    Ok(out)
}

/// Decrypt `[nonce || ciphertext+tag]` ⇒ plaintext. Returns AeadFailed for
/// any tampering / wrong-key / truncation — never panics.
pub fn decrypt(master: &MasterKey, blob: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if blob.len() < 12 + 16 {
        return Err(CryptoError::CiphertextTooShort);
    }
    let (nonce_bytes, ct) = blob.split_at(12);
    let cipher = Aes256Gcm::new(&master.0);
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ct)
        .map_err(|_| CryptoError::AeadFailed)
}

/// Extract a small visible suffix (last 4 chars of the plaintext key) so the
/// UI can render "sk-••••ab12" without round-tripping through decrypt.
pub fn key_suffix(plaintext: &str) -> String {
    let s = plaintext.trim();
    if s.len() <= 4 {
        s.to_string()
    } else {
        s.chars().skip(s.chars().count().saturating_sub(4)).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_master() -> MasterKey {
        // 32 zero bytes, base64 encoded
        let zero = [0u8; 32];
        let b64 = BASE64.encode(zero);
        MasterKey::from_base64(&b64).expect("zero key decodes")
    }

    #[test]
    fn roundtrip() {
        let m = test_master();
        let pt = b"sk-runway-abcd1234xyz";
        let ct = encrypt(&m, pt).expect("encrypt");
        assert_ne!(&ct[..], pt);
        assert!(ct.len() >= 12 + pt.len() + 16);
        let got = decrypt(&m, &ct).expect("decrypt");
        assert_eq!(got, pt);
    }

    #[test]
    fn tamper_fails() {
        let m = test_master();
        let mut ct = encrypt(&m, b"hello").expect("enc");
        let n = ct.len();
        ct[n - 1] ^= 0xFF;
        assert!(decrypt(&m, &ct).is_err());
    }

    #[test]
    fn suffix() {
        assert_eq!(key_suffix("abcdefgh"), "efgh");
        assert_eq!(key_suffix("abc"), "abc");
        assert_eq!(key_suffix(""), "");
    }

    #[test]
    fn wrong_key_size_rejected() {
        let short = BASE64.encode([1u8; 16]);
        assert!(matches!(
            MasterKey::from_base64(&short),
            Err(CryptoError::MasterKeySize(16))
        ));
    }
}
