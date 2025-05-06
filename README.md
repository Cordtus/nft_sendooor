# ERC‑721 Collection Sweeper

A simple Node.js ESM script to move all your ERC‑721 tokens from one wallet to another, across one or more collections, via any EVM‑compatible JSON‑RPC.

## Features

- Supports a single collection (`COLLECTION_ADDR`) or multiple collections (`COLLECTION_ADDRS`, comma‑separated)  
- Enumerates owned token IDs (`balanceOf` + `tokenOfOwnerByIndex`)  
- Pipelines up to `MAX_IN_FLIGHT` concurrent transfers for maximum throughput  
- Retries failed transfers up to 3× with exponential backoff  
- Logs block number and transaction hash for each successful transfer

## Requirements

- Node.js ≥16  
- Yarn or npm  
- An EVM JSON‑RPC endpoint  

## Setup

1. Clone or copy the script into your project directory.  
2. Install dependencies:

   ```bash
   yarn add ethers dotenv
   # or
   npm install ethers dotenv
````

3. Create a `.env` file based on the template:

   ```env
   RPC_URL=https://your.rpc.endpoint
   SOURCE_KEY=0xYOUR_PRIVATE_KEY
   DEST_ADDRESS=0xYOUR_DESTINATION_ADDRESS

   # Single collection:
   COLLECTION_ADDR=0xCOLLECTION1

   # Or multiple (comma‑separated):
   # COLLECTION_ADDRS=0xCOLLECTION1,0xCOLLECTION2,0xCOLLECTION3

   # Optional: number of in‑flight transfers (default: 10)
   MAX_IN_FLIGHT=20
   ```

## Usage

```bash
node sweep-collections.js
```

Output logs will show:

* When fetching tokens for each collection
* Number of tokens found
* Success logs: `[block] contract#tokenId → destination (txHash)`
* Any retries or failures

## Customization

* **TypeScript**: Rename to `.ts`, add types, and compile.
* **Multi‑wallet**: Loop over multiple `SOURCE_KEY`/`DEST_ADDRESS` pairs.
* **Alternative enumeration**: Swap in a custom token‑ID fetcher if your contract doesn’t use ERC‑721 Enumerable.
