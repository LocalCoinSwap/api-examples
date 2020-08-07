import os
from dotenv import load_dotenv
from requests import Session
from pbkdf2 import PBKDF2
from Crypto.Cipher import AES
from Crypto.Hash import keccak
load_dotenv()

api_token = os.getenv("API_TOKEN")
exchange_password = os.getenv("ACCOUNT_PASSWORD")
url = "https://localcoinswap.com/api/v2/profile/encrypted-blob/"

s = Session()
s.headers.update({"Authorization": f"Token {api_token}"})

response = s.get(url).json()

salt_hex = bytes.fromhex(response["salt"])
iterations = int(response["iterations"])
initialization_vector = bytes.fromhex(response["initialization_vector"])
encrypted_account_key = response["encrypted_account_key"]
encrypted_mnemonic = response["encrypted_mnemonic"]
encrypted_mnemonic_iv = bytes.fromhex(response["encrypted_mnemonic_iv"])

# Combine salt and plaintext account password in PBKDF2 function
# to create a secret key.
account_key_secret = PBKDF2(exchange_password, salt_hex, iterations).read(32).hex()
print("accountKeySecret PBKDF2", account_key_secret, len(account_key_secret))

# Use initialization vector and secret key to decrypt the account key
crypto_worker = AES.new(
    bytes.fromhex(account_key_secret),
    AES.MODE_CBC,
    initialization_vector
)
account_key = crypto_worker.decrypt(bytes.fromhex(encrypted_account_key)).hex()[0:64]
print("Decrypted account key", account_key)

# Generate secret key for mnemonic with a SHA3 hash
secret_key = keccak.new(digest_bits=256)
secret_key.update('{}encryption'.format(account_key).encode('utf-8'))
mnemonic_secret_key = secret_key.hexdigest()
print("mnemonicSecretKey", mnemonic_secret_key, len(mnemonic_secret_key))

# Use initialization vector and secret key to decrypt the mnemonic
crypto_worker = AES.new(
    bytes.fromhex(mnemonic_secret_key),
    AES.MODE_CBC,
    encrypted_mnemonic_iv
)
mnemonicHex = crypto_worker.decrypt(bytes.fromhex(encrypted_mnemonic)).hex()[0:296]
mnemonic = bytes.fromhex(mnemonicHex).decode('utf-8')
print("Decrypted mnemonic hex", mnemonicHex)
print("Decrypted mnemonic", mnemonic)
