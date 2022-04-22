# Example for a non-custodial ETH trade using LocalCoinSwap API

This example shows API interactions from both Buyer and Seller perspectives. We will emulate a successful trade where Buyer starts a trade on an offer posted by Seller.

Note: All literal values in this example are assumed and not found in production. Please use the correct values to emulate your own trade.

### Step 1: Buyer starts the trade

We need an offer to start a trade. Offer is uniquely identified by their `uuid`. We have one `a346715c-a428-4b62-8034-f811b3426904`.

Buyer makes an API call:

Endpoint: `/api/v2/trades/non-custodial/create/`
Method: `POST`
Payload:

```
{
    "offer": "a346715c-a428-4b62-8034-f811b3426904",
    "fiat_amount": "51.53",
    "coin_amount": "0.017",
    "wallet_type": "webwallet",
    "wallet_address": "0x89D4542d6B902538e0f15751d1da28E2F45141DC"
}
```

 - `offer` is the uuid of the offer.
 - `coin_amount` and `fiat_amount` are bound by the offer rate offered by the seller. Changing one automatically updates the other in the LocalCoinSwap frontend. To get the rate set by the seller, look for `price_formula_value` key in the offer endpoint, `/api/v2/offers/a346715c-a428-4b62-8034-f811b3426904/`.
 - `wallet_type` could be either `webwallet` or `metamask`. This example assumes that we use `webwallet`.
 - `wallet_address` is the non-custodial wallet address used by the Buyer. This can be found from the LocalCoinSwap wallet page. As of this writing, every user gets only 1 non-custodial wallet, however, in future we plan to let users create new non-custodial wallets. Hence, we require that you pass this in the payload.

### Step 2: Seller accepts the trade

Once a trade begins, both Buyer and Seller can access it via the trade uuid, in this case, it is `ce59315f-f1e5-48aa-b8c9-06bfcec5a3f5`. It is used in all further API calls on the trade.
Also, note that the endpoint is different for non-custodial trade. You cannot use a custodial endpoint for non-custodial trade.

Seller makes an API call:

Endpoint: `/api/v2/trades/non-custodial/update/ce59315f-f1e5-48aa-b8c9-06bfcec5a3f5/`
Method: `PATCH`
Payload:

```
{
    "status": "ACCEPTED",
    "wallet_address": "0x3388C17E92880D479Fe2Af140B5CebCA78C9c956",
    "wallet_type": "webwallet"
}
```

After accepting the trade, Seller has to fund the escrow.

### Step 3: Seller funds escrow

Unlike custodial trade, non-custodial trades do not automatically move to escrow. Seller needs to sign a transaction, so there's a separate step for it.

Funding escrow is a 2-step process:

#### Part A: Seller requests transaction to sign

This call returns the transaction that Seller needs to sign. Since we don't hold the keys, we can't sign it. Seller needs to sign and send the signed transaction back to us.

Endpoint: `/api/v2/trades/non-custodial/update/ce59315f-f1e5-48aa-b8c9-06bfcec5a3f5/`
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
    "buyer_meta":{
        "address":"0x89D4542d6B902538e0f15751d1da28E2F45141DC",
        "wallet_type":"webwallet",
        "public_key":"afeaadd5943ea3e2000520e3c2ab4f39b384ab5c2c0bb220aded9203c884163ff478f14f3e6f8ac142860049ce7b1665351151ea314c62c98464dee8bb26fb30"
    },
    "seller_meta":{
        "public_key":"afeaadd5943ea3e2000520e3c2ab4f39b384ab5c2c0bb220aded9203c884163ff478f14f3e6f8ac142860049ce7b1665351151ea314c62c98464dee8bb26fb30",
        "address":"0x3388C17E92880D479Fe2Af140B5CebCA78C9c956",
        "wallet_type":"webwallet"
    },
    "tx_meta":{
        "trade_hash":"0xd6f0a0041e3b90b6f685e0e4f8fd4afe2651dca65ca46682fab6576db7af1450",
        "escrow_unsigned_tx":{
            "gas":120000,
            "gasPrice":"34741894317",
            "nonce":51,
            "value":"17170000000000000",
            "chainId":1,
            "to":"0x0e87bF5286C4091e0eeb7814D802115dFBb4c4cd",
            "data":"0xf100000000000000000ThisIsJustAnExample00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000016"
        }
    },
    "status":"WAITING_FOR_ESCROW",
    "uuid":"ce59315f-f1e5-48aa-b8c9-06bfcec5a3f5"
}

```

In the above response, `escrow_unsigned_tx` is the important bit. Sign this and make another API call to the same endpoint with following payload.

#### Part B: Seller signs transaction

Endpoint: `/api/v2/trades/non-custodial/update/ce59315f-f1e5-48aa-b8c9-06bfcec5a3f5/`
Method: `PATCH`
Payload:

```
{
    "signed_txn":"0xf9000000000000000000000000000000ThisIsJustAnExample00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000149d",
    "status":"WAITING_FOR_MIN_ESCROW_CONFIRMS"
}
```

**How to sign?**

Here's a demonstration in JS. You can perform similar signing in Python or your favorite language.

```js
import { ec } from 'elliptic'
import { computeAddress, serialize } from '@ethersproject/transactions'
import { Bytes } from '@ethersproject/bytes'
import { keccak256 } from '@ethersproject/keccak256'
import {
  arrayify,
  hexZeroPad,
  splitSignature,
  joinSignature,
} from '@ethersproject/bytes'

const SELLER_PRIVATE_KEY_HEX = ''

// Helper function to sign a string
async signMessage(message: string | Bytes): Promise<string> {
    const curve = new ec('secp256k1')
    const keyPair = curve.keyFromPrivate(arrayify(SELLER_PRIVATE_KEY_HEX))
    const digestBytes = arrayify(message)
    if (digestBytes.length !== 32) {
        console.error('bad digest length', 'digest', message)
    }
    const signature = keyPair.sign(digestBytes, { canonical: true })

    const rawSignature = joinSignature(
        splitSignature({
            recoveryParam: signature.recoveryParam,
            r: hexZeroPad('0x' + signature.r.toString(16), 32),
            s: hexZeroPad('0x' + signature.s.toString(16), 32),
        })
    )

    return rawSignature
}

// Prepare the tx correctly for signing
const tx = trade.tx_meta.escrow_unsigned_tx
tx.gasLimit = tx.gas
tx.value = BigNumber.from(tx.value.toString())
tx.gasPrice = BigNumber.from(tx.gasPrice.toString())
delete tx['gas']

// Sign the tx
const signature = await signMessage(keccak256(serialize(tx)))
const signed_txn = serialize(transaction, signature)

// Send the signed_txn back in the API call
```

Our backend will broadcast and start watching the transaction and based on the events emitted by our escrow smart contract, the trade will move further.

Both Buyer and Seller need to wait for the escrow to be safely funded. No API calls will be entertained during this state. Once the trade status reaches `CRYPTO_ESC` state, you can make further calls. You can poll (1 call per minute would be good, you might get throttled/blocked if it's too frequent) `/api/v2/trades/ce59315f-f1e5-48aa-b8c9-06bfcec5a3f5/` GET endpoint to request the current trade information.

There's also escrow transaction hash stored in `escrow_broadcast_tx` inside `tx_meta` key of the trade GET API response. You may choose to watch this as well. We require a minimum of 5 confirmations to move the trade to `CRYPTO_ESC` state.

### Step 4: Buyer says that fiat funds were sent to Seller

Buyer needs to send the agreed fiat funds abiding by the terms and payment method set by the Seller on the original Offer. Once done, Buyer can move the trade to the next stage.

Buyer makes an API call:

Endpoint: `/api/v2/trades/non-custodial/update/ce59315f-f1e5-48aa-b8c9-06bfcec5a3f5/`
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

Endpoint: `/api/v2/trades/non-custodial/update/ce59315f-f1e5-48aa-b8c9-06bfcec5a3f5/`
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

const SELLER_PRIVATE_KEY_HEX = ''
const INSTRUCTION = 0x01
const MAXIMUM_GAS_PRICE = 500000000000

// trade_uuid is the UUID you've been using to make API calls on this trade
const tradeID = `0x${trade_uuid.replace(/-/g, '')}`
const instruction_hash_bytes = abi.soliditySHA3(
    ['bytes16', 'uint8', 'uint128'],
    [tradeID, INSTRUCTION, MAXIMUM_GAS_PRICE]
)
const prefixed_hash = hashPersonalMessage(instruction_hash_bytes)
const signed = ecsign(prefixed_hash, toBuffer(SELLER_PRIVATE_KEY_HEX))
const r = bufferToHex(signed.r)
const s = bufferToHex(signed.s)
const v = signed.v

const signed_relay_signature = {
    "r": r,
    "s": s,
    "v": v,
}

```

Our backend will broadcast and start watching the release transaction and based on the events emitted by our escrow smart contract, the trade will move further.

There's a release transaction hash stored in `release_signed_tx` inside `tx_meta` key of the trade GET API response.

The trade `status` will be marked `COMPLETED` as soon as there are minimum 5 confirmations on the release transaction.
