# Example for a non-custodial BTC trade using LocalCoinSwap API

This example shows API interactions from both Buyer and Seller perspectives. We will emulate a successful trade where Buyer starts a trade on an offer posted by Seller.

Note: All literal values in this example are assumed and not found in production. Please use the correct values to emulate your own trade.

### Step 1: Buyer starts the trade

We need an offer to start a trade. Offer is uniquely identified by their `uuid`. We have one `d24a3cee-b0d1-47dd-b7b9-a08172023275`.

Buyer makes an API call:

Endpoint: `/api/v2/trades/non-custodial/create/`
Method: `POST`
Payload:

```
{
    "offer": "d24a3cee-b0d1-47dd-b7b9-a08172023275",
    "coin_amount": "0.001",
    "fiat_amount": "22.12",
    "wallet_type": "webwallet",
    "wallet_address": "3NyHVivWjXP45VkHCNWVSbtPhnsCtwaUXr",
    "btc_trade_secrets": {
        "encrypted_secret": "9ad555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555570",
        "hashed_public_key": "3eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee1",
        "hashed_secret": "33eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee53"
    }
}
```

 - `offer` is the uuid of the offer.
 - `coin_amount` and `fiat_amount` are bound by the offer rate offered by the seller. Changing one automatically updates the other in the LocalCoinSwap frontend. To get the rate set by the seller, look for `price_formula_value` key in the offer endpoint, `/api/v2/offers/d24a3cee-b0d1-47dd-b7b9-a08172023275/`.
 - `wallet_type` could be either `webwallet` or `metamask`. This example assumes that we use `webwallet`.
 - `wallet_address` is the non-custodial wallet address used by the Buyer. This can be found from the LocalCoinSwap wallet page. As of this writing, every user gets only 1 non-custodial wallet, however, in future we plan to let users create new non-custodial wallets. Hence, we require that you pass this in the payload.

 - `btc_trade_secrets` - This is a critical part of non-custodial BTC trade. Here's a JS script to help create these values


```js

MNEMONIC = "twenty four word mnemonic here"  // You can find this in Security Settings: https://localcoinswap.com/preferences/security 
ACCOUNT_KEY = "" // This is found at the same place, displayed below the mnemonic after you decrypt it UI

WALLET_PRIVATE_KEY = "" // This can be found in your Bitcoin Wallet page 

// We'll generate 3 parameters here
// 1. hashedSecret
// 2. encryptedSecret
// 3. hashedPublicKey

const epochTimeNow = Date.now().toString()

const secret = getDeterministicTradeSecret(MNEMONIC, epochTimeNow) // This function in defined below 
const hashedSecret = hash160(secret)

const encryptedSecret = encryptTradeSecret(
    secret,
    ACCOUNT_KEY,
    undefined
)

const publicKey = privateKeyToPublic(privateKey)
const hashedPublicKey = hash160(publicKey)

const btc_trade_secrets = {
    encrypted_secret: encryptedSecret,
    hashed_secret: hashedSecret,
    hashed_public_key: hashedPublicKey,
}
```

### Helper functions for the above script


```js
// Packages
// "bitcoinjs-lib": "^5.2.0"
// "bip39": "^3.0.2"
// "bip32": "2.0.5"
// "crypto-js": "^3.1.9-1"
// "tiny-secp256k1": "^1.1.3"
// "wif": "^2.0.6"

import { crypto } from 'bitcoinjs-lib'
import CryptoJS from 'crypto-js'
import ecc from 'tiny-secp256k1'
import wif from 'wif'

import * as bip39 from 'bip39'
import * as bip32 from 'bip32'

export function getDeterministicTradeSecret(mnemonic, passphrase) {
  const btcSecretPathString = "m/49'/0'/99'/0"

  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
  const root = bip32.fromSeed(seed)
  const child = root.derivePath(`${btcSecretPathString}/0`)

  const tradeSecret = child.publicKey.toString('hex')
  return tradeSecret
}

export const convertBytesToHex = (bytes) => {
  const result = []
  const Hex = '0123456789abcdef'
  for (let i = 0; i < bytes.length; i += 1) {
    const v = bytes[i]
    result.push(Hex[(v & 0xf0) >> 4] + Hex[v & 0x0f])
  }
  return result.join('')
}

export const hash160 = (hexString) => {
  const byteArray = Buffer.from(hexString, 'hex')
  return convertBytesToHex(crypto.hash160(byteArray))
}

export const encryptTradeSecret = (tradeSecretHex, accountKey, iv) => {
  const secretKey = CryptoJS.SHA3(`${accountKey}encryption`, {
    outputLength: 256,
  })
  const encryptedTradeSecret = CryptoJS.AES.encrypt(tradeSecretHex, secretKey, {
    mode: CryptoJS.mode.CBC,
    iv,
  })
  const ciphertextHex = CryptoJS.enc.Hex.stringify(
    encryptedTradeSecret.ciphertext
  )
  return ciphertextHex
}

export const privateKeyToPublic = (privateKey) => {
  const decoded = wif.decode(privString)
  return ecc.pointFromScalar(decoded.privateKey, decoded.compressed)
}

```

### Step 2: Seller accepts the trade

Once a trade begins, both Buyer and Seller can access it via the trade uuid, in this case, it is `fb923426-90e5-4dd5-8c32-f8f2dff4fa97`. It is used in all further API calls on the trade.
Also, note that the endpoint is different for non-custodial trade. You cannot use a custodial endpoint for non-custodial trade.

Seller makes an API call:

Endpoint: `/api/v2/trades/non-custodial/update/fb923426-90e5-4dd5-8c32-f8f2dff4fa97/`
Method: `PATCH`
Payload:

```
{
    "status": "ACCEPTED",
    "wallet_address": "39eDV8vYJCLWBM6qu5emiYFLAyXuCaHTqf",
    "wallet_type": "webwallet",
    "btc_trade_secrets": {
        "encrypted_secret": "6b333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333337de",
        "hashed_secret": "8333333333333333333333333333333333333333333331",
        "hashed_public_key": "cccccccccccccccccccccccccccccccccccccccf6"
    }
}
```

Again, `btc_trade_secrets` is generated using the scripts we saw before.

After accepting the trade, Seller has to fund the escrow.

### Step 3: Seller funds escrow

Non-custodial trades do not automatically move to escrow. Seller needs to sign a transaction, so there's a separate step for it.

Endpoint: `/api/v2/trades/non-custodial/update/fb923426-90e5-4dd5-8c32-f8f2dff4fa97/`
Method: `PATCH`
Payload:

```
{
    "status": "WAITING_FOR_MIN_ESCROW_CONFIRMS",
    "signed_txn": "0200000REALLYYYYYYYYYYYYYYYYYYYYYYYYYYYLOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOONGGGGGGSIGNEDTXNc374900000000"
}
```

**How to sign?**

Here's a demonstration in JS. You can perform similar signing in Python or your favorite language.

```js
// TO BE ADDED
```

Our backend will broadcast and start watching the transaction and based on the events emitted by our escrow smart contract, the trade will move further.

Both Buyer and Seller need to wait for the escrow to be safely funded. No API calls will be entertained during this state. Once the trade status reaches `CRYPTO_ESC` state, you can make further calls. You can poll (1 call per minute would be good, you might get throttled/blocked if it's too frequent) `/api/v2/trades/fb923426-90e5-4dd5-8c32-f8f2dff4fa97/` GET endpoint to request the current trade information.

There's also escrow transaction hash stored in `escrow_broadcast_tx` inside `tx_meta` key of the trade GET API response. You may choose to watch this as well. We require a minimum of 5 confirmations to move the trade to `CRYPTO_ESC` state.

### Step 4: Buyer says that fiat funds were sent to Seller

Buyer needs to send the agreed fiat funds abiding by the terms and payment method set by the Seller on the original Offer. Once done, Buyer can move the trade to the next stage.

Buyer makes an API call:

Endpoint: `/api/v2/trades/non-custodial/update/fb923426-90e5-4dd5-8c32-f8f2dff4fa97/`
Method: `PATCH`
Payload:

```
{
    "status": "FUND_PAID"
}
```

### Step 5: Seller confirms the receipt of fiat payment

Confirming fiat receipt means that seller now wants to release the escrowed crypto funds.

Seller should verify if the fiat funds are indeed received and agreed amount. If everything's alright, move the trade to the next stage.

Seller makes an API call:

Endpoint: `/api/v2/trades/non-custodial/update/fb923426-90e5-4dd5-8c32-f8f2dff4fa97/`
Method: `PATCH`
Payload:

```
{
    "status": "FUND_RECEIVED",
    "seller_secret": "04cfffffffffffffffffffffffffffffffffffffffffffffLONNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv3d"
}
```

**How to create `seller_secret` ?**

Here's a demonstration in JS.

```js
const ACCOUNT_KEY = ""

// Important stuff from the response above, you can also find these in GET trade API
const SELLER_META = response.seller_meta
const BUYER_META = response.seller_meta

const { seller_encrypted_secret } = SELLER_META
const { public_key } = BUYER_META
const trade_secret = decryptTradeSecret(
    seller_encrypted_secret,
    ACCOUNT_KEY,
    undefined
)
const seller_secret = encryptMessageWithAccountPublicKey(
    trade_secret,
    public_key
)

```

Helper functions for the above script

```js
// Packages
// "eciesjs": "^0.3.9",
// "crypto-js": "^3.1.9-1"

import { encrypt } from 'eciesjs'
import CryptoJS from 'crypto-js'

export function decryptTradeSecret(
  encryptedTradeSecretHex,
  accountKey,
  iv
) {
  const secretKey = CryptoJS.SHA3(`${accountKey}encryption`, {
    outputLength: 256,
  })
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Hex.parse(encryptedTradeSecretHex),
  })
  const tradeSecret = CryptoJS.AES.decrypt(cipherParams, secretKey, {
    mode: CryptoJS.mode.CBC,
    iv,
  })
  return CryptoJS.enc.Utf8.stringify(tradeSecret)
}

export const encryptMessageWithAccountPublicKey = (message, publicKey) => {
  const messageBytes = Buffer.from(message, 'utf8')
  const encryptedMessage = encrypt(publicKey, messageBytes)
  return encryptedMessage.toString('hex')
}
```

Our backend will broadcast and start watching the release transaction and based on the events emitted by our escrow smart contract, the trade will move further.

There's a release transaction hash stored in `release_signed_tx` inside `tx_meta` key of the trade GET API response.

The trade `status` will be marked `COMPLETED` as soon as there are minimum 5 confirmations on the release transaction.
