// Encrypt the message using a generated key
function encrypt(message, key) {
  return CryptoJS.AES.encrypt(message, key).toString();
}

// Encode to base64
function encodeBase64(value) {
  return btoa(value);
}
