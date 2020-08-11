import axios from "axios";
import CryptoJS from "crypto-js";
import { apiToken, exchangePassword } from '../config.js';


async function decryptEncryptedBlob() {
  // Encrypted blob URL
  const url = "https://localcoinswap.com/api/v2/profile/encrypted-blob/";

  // Make a get request to blob URL for account data
  const result = await axios.get(url, {headers: {"Authorization": `Token ${apiToken}`}})

  // Parse encrypted parameters from GET request
  const saltHex = result.data.salt;
  const iterations = result.data.iterations;
  const accountKeyIVHex = result.data.initialization_vector;
  const encryptedAccountKey = result.data.encrypted_account_key;

  const encryptedMnemonicHex = result.data.encrypted_mnemonic;
  const mnemonicIVHex = result.data.encrypted_mnemonic_iv;

  // Combine salt and plaintext account password in PBKDF2 function
  // to create a secret key.
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const accountKeySecret = CryptoJS.PBKDF2(exchangePassword, salt, {
    keySize: 256 / 32,
    iterations,
  });
  console.log('accountKeySecret PBKDF2', CryptoJS.enc.Hex.stringify(accountKeySecret))

  // Use initialization vector and secret key to decrypt the account key
  const accountKeyParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Hex.parse(encryptedAccountKey),
  });
  const accountKey = CryptoJS.AES.decrypt(accountKeyParams, accountKeySecret, {
    mode: CryptoJS.mode.CBC,
    iv: CryptoJS.enc.Hex.parse(accountKeyIVHex),
  });
  const accountKeyHexString = CryptoJS.enc.Hex.stringify(accountKey);
  console.log(`Decrypted account key ${accountKeyHexString}`);

  // Generate secret key for mnemonic with a SHA3 hash
  const mnemonicSecretKey = CryptoJS.SHA3(`${accountKeyHexString}encryption`, { outputLength: 256 });
  console.log(`mnemonicSecretKey ${mnemonicSecretKey}`);

  // Use initialization vector and secret key to decrypt the mnemonic
  const mnemonicParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Hex.parse(encryptedMnemonicHex),
  });
  const mnemonic = CryptoJS.AES.decrypt(mnemonicParams, mnemonicSecretKey, {
    mode: CryptoJS.mode.CBC,
    iv: CryptoJS.enc.Hex.parse(mnemonicIVHex),
  });
  const mnemonicHex = CryptoJS.enc.Hex.stringify(mnemonic);
  const mnemonicString = CryptoJS.enc.Utf8.stringify(mnemonic);
  console.log(`Decrypted mnemonic hex ${mnemonicHex}`);
  console.log(`Decrypted mnemonic ${mnemonicString}`);
}

decryptEncryptedBlob();
