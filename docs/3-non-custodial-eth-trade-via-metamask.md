# Example for a non-custodial ETH trade using LocalCoinSwap API and Metamask

This example shows API interactions from both Buyer and Seller perspectives. We will emulate a successful trade where Buyer starts a trade on an offer posted by Seller. Seller is using Metamask wallet and Buyer is using LocalCoinSwap's non-custodial wallet.

Note: All literal values in this example are assumed and not found in production. Please use the correct values to emulate your own trade.

### Step 1: Buyer starts the trade

We need an offer to start a trade. Offer is uniquely identified by their `uuid`. We have one `3159753c-168d-4157-a719-ed8c8c26e613`.

Buyer makes an API call:

Endpoint: `/api/v2/trades/non-custodial/create/`
Method: `POST`
Payload:

```
{
    "offer": "3159753c-168d-4157-a719-ed8c8c26e613",
    "fiat_amount": "33.32",
    "coin_amount": "0.02",
    "wallet_type": "webwallet",
    "wallet_address": "0x3a72Bb7AdfF8dB8d326B2bF17AD53A32920b04f9"
}
```

 - `offer` is the uuid of the offer.
 - `coin_amount` and `fiat_amount` are bound by the offer rate offered by the seller. Changing one automatically updates the other in the LocalCoinSwap frontend. To get the rate set by the seller, look for `price_formula_value` key in the offer endpoint, `/api/v2/offers/3159753c-168d-4157-a719-ed8c8c26e613/`.
 - `wallet_type` could be either `webwallet` or `metamask`. This example assumes that the Buyer is using `webwallet`.
 - `wallet_address` is the non-custodial wallet address used by the Buyer. This can be found from the LocalCoinSwap wallet page. As of this writing, every user gets only 1 non-custodial wallet, however, in future we plan to let users create new non-custodial wallets. Hence, we require that you pass this in the payload.

### Step 2: Seller accepts the trade

Once a trade begins, both Buyer and Seller can access it via the trade uuid, in this case, it is `03118b30-2fbb-420c-a193-8ac94b1fb190`. It is used in all further API calls on the trade.
Also, note that the endpoint is different for non-custodial trade. You cannot use a custodial endpoint for non-custodial trade.

Seller makes an API call:

Endpoint: `/api/v2/trades/non-custodial/update/03118b30-2fbb-420c-a193-8ac94b1fb190/`
Method: `PATCH`
Payload:


```
{
    "status": "ACCEPTED",
    "wallet_address": "0x8c76e7b9702cf6334f303769f0ef28265a366981",
    "wallet_type": "metamask"
}
```

After accepting the trade, Seller has to fund the escrow.

### Step 3: Seller funds escrow

Unlike custodial trade, non-custodial trades do not automatically move to escrow. Seller needs to sign a transaction, so there's a separate step for it.

Funding escrow is a 2-step process:

#### Part A: Seller requests transaction to sign

This call returns the transaction that Seller needs to sign. Since we don't hold the keys, we can't sign it. Seller needs to sign and send the signed transaction back to us.

Endpoint: `/api/v2/trades/non-custodial/update/03118b30-2fbb-420c-a193-8ac94b1fb190/`
Method: `PATCH`
Payload:

```
{
    "status": "CRYPTO_ESC"
}
```

Response:

```
{
    "uuid":"03118b30-2fbb-420c-a193-8ac94b1fb190",
    "tx_meta": {
        "trade_hash": "0xd227cb6d3fd80ef31f98550ee51e27a08a6f67bd836379606421c8df93a4f3e5",
        "escrow_unsigned_tx": {
            "gas": 120000,
            "gasPrice": "30000000000",
            "nonce": 27,
            "value": "20200000000000000",
            "chainId": 1,
            "to": "0x0e87bF5286C4091e0eeb7814D802115dFBb4c4cd",
            "data": "0xf100000000000000000ThisIsJustAnExample00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000016"
        }
    },
    "buyer_meta": {
        "address": "0x3a72Bb7AdfF8dB8d326B2bF17AD53A32920b04f9",
        "wallet_type": "webwallet",
        "public_key": "5e46d9fa9cf60664cdaf19a1d4d46a7f1ca3050b6f6e5a7d4762ce2bf83b66d1f0f99d59eb33236e550a9790e3b13437663229159119dd736a8d6049d7ef3d1e"
    },
    "seller_meta": {
        "public_key": "56857e3ba761b7a6e3c85b3e7ff6d435b50255e95b71e03e18a0d8e2a2f6283f7d1a1ba1819a0b9f1036714cc7ab5fdb1b9148ce64034c9129cb6a288fe3d1ff",
        "address": "0x8c76e7b9702cf6334f303769f0ef28265a366981",
        "wallet_type": "metamask"
    },
    "non_custodial": true,
    "amount_to_escrow": "0.020200000000000000",
    "local_currency_symbol": "USD",
    "crypto_in_local_currency": "32.98871015128400000000000000"
}

```

In the above response, `escrow_unsigned_tx` is the important bit. Sign this and make another API call to the same endpoint with following payload. There maybe more keys in the response, only the important ones are shown above.

#### Part B: Seller signs transaction and broadcast it via Metamask wallet

Endpoint: `/api/v2/trades/non-custodial/update/03118b30-2fbb-420c-a193-8ac94b1fb190/`
Method: `PATCH`
Payload:


```
{
    "broadcasted_txn_hash":"0x565dd422fb66800575fa8227d3d98a7f2ecbbe64738d8c3a9abf5b8d757d15ac",
    "signed_txn": "NULL_FOR_METAMASK",
    "status":"WAITING_FOR_MIN_ESCROW_CONFIRMS"
}
```

**How to sign?**

Here's a demonstration in JS. You can perform similar signing in Python or your favorite language.

```js
// Package
// "ethereumjs-abi": "^0.6.8",
// "ethereumjs-util": "^7.0.7",
// "ethers": "^5.0.26",

import { fromRpcSig, bufferToHex, intToHex } from 'ethereumjs-util'
import abi from 'ethereumjs-abi'
import { BigNumber } from 'ethers'

// Important stuff from the response above
const TX_META = response.tx_meta
const SELLER_META = response.seller_meta

// Construct Metamask API payload
const transaction = TX_META.escrow_unsigned_tx
transaction.from = SELLER_META.address
transaction.value = BigNumber.from(transaction.value).toHexString()
transaction.gas = intToHex(transaction.gas)
transaction.gasPrice = BigNumber.from(transaction.gasPrice).toHexString()
delete transaction.nonce


// After this, you need to broadcast the `transaction` using Metamask
// In browser, we do it like this

const txnHash = await new Promise((resolve, reject) => {
    window.ethereum.enable()
    window.ethereum
      .send('eth_sendTransaction', [transaction])
      .then((response) => {
        resolve(response.result)
      })
  })

// window.ethereum is available after you connect Metamask browser extension
// You can then send this `txnHash` back to us as `broadcasted_txn_hash` in the API call.
```

Our backend will start watching the transaction and based on the events emitted by our escrow smart contract, the trade will move further.

Both Buyer and Seller need to wait for the escrow to be safely funded. No API calls will be entertained during this state. Once the trade status reaches `CRYPTO_ESC` state, you can make further calls. You can poll (1 call per minute would be good, you might get throttled/blocked if it's too frequent) `/api/v2/trades/03118b30-2fbb-420c-a193-8ac94b1fb190/` GET endpoint to request the current trade information.

There's also escrow transaction hash stored in `escrow_broadcast_tx` inside `tx_meta` key of the trade GET API response. You may choose to watch this as well. We require a minimum of 5 confirmations to move the trade to `CRYPTO_ESC` state.

### Step 4: Buyer says that fiat funds were sent to Seller

Buyer needs to send the agreed fiat funds abiding by the terms and payment method set by the Seller on the original Offer. Once done, Buyer can move the trade to the next stage.

Buyer makes an API call:

Endpoint: `/api/v2/trades/non-custodial/update/03118b30-2fbb-420c-a193-8ac94b1fb190/`
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

Endpoint: `/api/v2/trades/non-custodial/update/03118b30-2fbb-420c-a193-8ac94b1fb190/`
Method: `PATCH`
Payload:

```
{
    "status":"FUND_RECEIVED",
    "signed_relay_signature":{
        "r":"0xcc000000000000000000000000000example000000000000000000000005d69a",
        "s":"0x6300000000000000000000000000example000000000000000000000675a1b87",
        "v":27
    }
}
```

**How to create `signed_relay_signature` ?**

Here's a demonstration in JS.

```js
import abi from 'ethereumjs-abi'
import {
    bufferToHex,
    ecsign,
    hashPersonalMessage,
    toBuffer,
} from 'ethereumjs-util'

SELLER_ADDRESS = "0x8c76e7b9702cf6334f303769f0ef28265a366981" // Metamask address you used to initially fund the escrow
const INSTRUCTION = 0x01
const MAXIMUM_GAS_PRICE = 500000000000

// trade_uuid is the UUID you've been using to make API calls on this trade
const tradeID = `0x${trade_uuid.replace(/-/g, '')}`
const instructionHashBytes = abi.soliditySHA3(
    ['bytes16', 'uint8', 'uint128'],
    [tradeID, INSTRUCTION, MAXIMUM_GAS_PRICE]
)
// NOTE: We do not perform any prefixing ourselves using ethereumjs-util 'hashPersonalMessage'
//  because the MetaMask personal_sign method does this for us
const prefixedHashToSign = bufferToHex(instructionHashBytes)

// After this, you need to sign the `prefixedHashToSign` using Metamask
// In browser, we do it like this

const metamaskResponse: string = await new Promise((resolve, reject) => {
    const msg = prefixedHashToSign
    const from = SELLER_ADDRESS
    const params = [msg, from]
    const method = 'personal_sign'
    window.ethereum.enable()
    window.ethereum.sendAsync({ method, params, from, }, (err, result) => {
        return resolve(result.result)
    })
})

const signatureParams = fromRpcSig(metamaskResponse)
const r = bufferToHex(signatureParams.r)
const s = bufferToHex(signatureParams.s)
const { v } = signatureParams

const signed_relay_signature = {
    "r": r,
    "s": s,
    "v": v,
}
// Send this in the API call as mentioned above

```

Our backend will broadcast and start watching the release transaction and based on the events emitted by our escrow smart contract, the trade will move further.

There's a release transaction hash stored in `release_signed_tx` inside `tx_meta` key of the trade GET API response.

The trade `status` will be marked `COMPLETED` as soon as there are minimum 5 confirmations on the release transaction.
