// scripts/hash-password.js — generate a bcrypt hash to store in account.credentials_hash
// Usage: node scripts/hash-password.js "your-password"
const bcrypt = require('bcryptjs');
const pw = process.argv[2];
if (!pw) { console.error('usage: node scripts/hash-password.js "<password>"'); process.exit(1); }
console.log(bcrypt.hashSync(pw, 10));
