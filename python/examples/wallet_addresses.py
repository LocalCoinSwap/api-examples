import os
from dotenv import load_dotenv
from requests import Session

load_dotenv()
api_token = os.getenv("API_TOKEN")
exchange_password = os.getenv("ACCOUNT_PASSWORD")

s = Session()
s.headers.update({"Authorization": f"Token {api_token}"})

# Kusama address from exchange
url = "https://localcoinswap.com/api/v2/wallets/info/KSM/"
first_kusama_address = s.get(url).json()['wallets'][0]['address']
print("Kusama", first_kusama_address)

# Bitcoin address
url = "https://localcoinswap.com/api/v2/wallets/info/BTC/"
first_bitcoin_address = s.get(url).json()['nc_wallets'][0]['address']
print("Bitcoin", first_bitcoin_address)

# Ethereum address
url = "https://localcoinswap.com/api/v2/wallets/info/ETH/"
first_ethereum_address = s.get(url).json()['wallets'][0]['address']
print("Ethereum", first_ethereum_address)
