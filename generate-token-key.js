import crypto from 'crypto';

/**
 * Generate a random cryptographic key for JWT tokens
 * @param {number} length - Length of the key in bytes (default: 64)
 * @returns {string} - Random hex string
 */
function generateTokenKey(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

// Generate different key lengths
console.log('=== JWT Token Key Generator ===\n');

console.log('ACCESS_TOKEN_SECRET (64 bytes):');
console.log(generateTokenKey(64));
console.log('\n');

console.log('REFRESH_TOKEN_SECRET (64 bytes):');
console.log(generateTokenKey(64));
console.log('\n');

console.log('EMAIL_VERIFICATION_SECRET (32 bytes):');
console.log(generateTokenKey(32));
console.log('\n');

console.log('PASSWORD_RESET_SECRET (32 bytes):');
console.log(generateTokenKey(32));
console.log('\n');

// Generate custom length if provided as command line argument
const customLength = process.argv[2];
if (customLength) {
  const length = parseInt(customLength);
  if (!isNaN(length) && length > 0) {
    console.log(`CUSTOM_SECRET (${length} bytes):`);
    console.log(generateTokenKey(length));
    console.log('\n');
  } else {
    console.log('Invalid length provided. Please provide a positive number.');
  }
}

console.log('=== Usage Instructions ===');
console.log('1. Copy the generated keys above');
console.log('2. Add them to your .env file');
console.log('3. Never commit these keys to version control');
console.log('4. Generate new keys for different environments (dev, staging, production)');
console.log('\nTo generate a custom length key, run:');
console.log('node generate-token-key.js <length_in_bytes>');
console.log('Example: node generate-token-key.js 128');
