# Example for a custodial BTC trade using LocalCoinSwap API

This example shows API interactions from both Buyer and Seller perspectives. We will emulate a successful trade where Buyer starts a trade on an offer posted by Seller.

Note: All literal values in this example are assumed and not found in production. Please use the correct values to emulate your own trade.

### Step 1: Buyer starts the trade

We need an offer to start a trade. Offer is uniquely identified by their `uuid`. We have one `2976e635-e93a-4d82-b937-18bb31da5d80`.

Buyer makes an API call:

Endpoint: `/api/v2/trades/custodial/create/`
Method: `POST`
Payload:

```
{
    "offer": "2976e635-e93a-4d82-b937-18bb31da5d80",
    "coin_amount": "0.00244861",
    "fiat_amount": "100",
}
```

 - `offer` is the uuid of the offer.
 - `coin_amount` and `fiat_amount` are bound by the offer rate offered by the seller. Changing one automatically updates the other in the LocalCoinSwap frontend. To get the rate set by the seller, look for `price_formula_value` key in the offer endpoint, `/api/v2/offers/2976e635-e93a-4d82-b937-18bb31da5d80/`.

### Step 2: Seller accepts the trade

Once a trade begins, both Buyer and Seller can access it via the trade uuid, in this case, it is `6823e07e-35b7-4dd1-b5d5-76238098d80a`. It is used in all further API calls on the trade.

Seller makes an API call:

Endpoint: `/api/v2/trades/custodial/update/6823e07e-35b7-4dd1-b5d5-76238098d80a/`
Method: `PATCH`
Payload:

```
{
    "status": "ACCEPTED"
}
```

At this stage, if the Seller's custodial wallet has enough BTC, then the system automatically puts them in Escrow and moves the trade one step further.
However, if Seller's custodial wallet doesn't have enough BTC, then the trade waits for the Seller to fund their custodial wallet. Once funded, Seller can make another API call to the same endpoint with Payload `{"status": "CRYPTO_ESC"}`

Crypto funds are securely stored in Escrow at the end of this stage.

### Step 3: Buyer says that fiat funds were sent to Seller

Buyer needs to send the agreed fiat funds abiding by the terms and payment method set by the Seller on the original Offer. Once done, Buyer can move the trade to the next stage.

Buyer makes an API call:

Endpoint: `/api/v2/trades/custodial/update/6823e07e-35b7-4dd1-b5d5-76238098d80a/`
Method: `PATCH`
Payload:

```
{
    "status": "FUND_PAID"
}
```

### Step 4: Seller confirms the receipt of fiat payment

Seller should verify if the fiat funds are indeed received and agreed amount. If everything's alright, move the trade to the next stage.

Seller makes an API call:

Endpoint: `/api/v2/trades/custodial/update/6823e07e-35b7-4dd1-b5d5-76238098d80a/`
Method: `PATCH`
Payload:

```
{
    "status": "FUND_RECEIVED"
}
```

At the end of this stage, the escrowed crypto funds are released to the Buyer and the trade is set completed.
