## LocalCoinSwap Cryptography

This is a simple demonstration of some of the cryptography underpinning the LocalCoinSwap exchange. You can use this to perform various trading functionality offline, or work with the private keys to your account.

You can use the examples contained in this repository to verify that LocalCoinSwap does not have access to your non-custodial private keys. As developers will see from the code, your password which is used for decrypting private keys is never sent to us. Instead, it is used for decrypting the private keys which we store on your behalf after you encrypt them and send them to us.

(This is a similar setup used by many non-custodial wallet providers)

### Installation

Javascript:
```
cd javascript
touch .env
yarn install
```

Add your keys to your .env file so it looks something like:
```
API_TOKEN=<Token from exchange>
ACCOUNT_PASSWORD=<Password for exchange>
```

Run examples:
```
node index.js
```

Python:
```
cd python
pyenv install 3.8.1
pyenv virtualenv 3.8.1 lcscrypto
pyenv local lcscrypto
pip3 install -r requirements.txt
```

Run examples:
```
python examples.py
```
