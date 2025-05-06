import { config } from "dotenv";
config();

import { ethers } from "ethers";

// ─── CONFIG ───────────────────────────────────────────
const {
  RPC_URL,
  SOURCE_KEY,
  DEST_ADDRESS,
  COLLECTION_ADDR,     // legacy single
  COLLECTION_ADDRS,    // comma‑separated list
  MAX_IN_FLIGHT = "10",
} = process.env;

if (!RPC_URL || !SOURCE_KEY || !DEST_ADDRESS || (!COLLECTION_ADDR && !COLLECTION_ADDRS)) {
  console.error(
    "Missing one of RPC_URL, SOURCE_KEY, DEST_ADDRESS and either COLLECTION_ADDR or COLLECTION_ADDRS in .env"
  );
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(SOURCE_KEY, provider);
const MAX_IN_FLIGHT_NUM = parseInt(MAX_IN_FLIGHT, 10);

// parse collections into array
const collections = COLLECTION_ADDRS
  ? COLLECTION_ADDRS.split(",").map((s) => s.trim())
  : [COLLECTION_ADDR.trim()];

// minimal ERC‑721 enumerable ABI
const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
];

async function fetchTokenIds(contractAddr) {
  const contract = new ethers.Contract(contractAddr, ERC721_ABI, wallet);
  const balance = await contract.balanceOf(wallet.address);
  const ids = [];
  for (let i = 0; i < balance; i++) {
    ids.push(await contract.tokenOfOwnerByIndex(wallet.address, i));
  }
  return ids;
}

async function transferWithRetry(contractAddr, tokenId, retries = 3) {
  const contract = new ethers.Contract(contractAddr, ERC721_ABI, wallet);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const tx = await contract.safeTransferFrom(
        wallet.address,
        DEST_ADDRESS,
        tokenId
      );
      const receipt = await tx.wait();
      console.log(
        `✅ [${receipt.blockNumber}] ${contractAddr}#${tokenId} → ${DEST_ADDRESS} (${receipt.transactionHash})`
      );
      return;
    } catch (err) {
      console.warn(
        `⚠️  ${contractAddr}#${tokenId} failed (attempt ${attempt}): ${err.message}`
      );
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function sweepCollection(contractAddr) {
  console.log(`\n🔍 fetching from ${contractAddr}…`);
  const tokens = await fetchTokenIds(contractAddr);
  console.log(`📦 found ${tokens.length} tokens in ${contractAddr}`);
  let inFlight = 0;
  let idx = 0;

  return new Promise((resolve) => {
    const pump = async () => {
      if (idx >= tokens.length && inFlight === 0) {
        return resolve();
      }
      while (inFlight < MAX_IN_FLIGHT_NUM && idx < tokens.length) {
        const tokenId = tokens[idx++];
        inFlight++;
        transferWithRetry(contractAddr, tokenId)
          .catch((err) =>
            console.error(
              `❌ ${contractAddr}#${tokenId} final failure: ${err.message}`
            )
          )
          .finally(() => {
            inFlight--;
            pump();
          });
      }
    };
    pump();
  });
}

async function main() {
  console.log(`🎯 sweeping ${collections.length} collection(s) to ${DEST_ADDRESS}`);
  for (const addr of collections) {
    await sweepCollection(addr);
  }
  console.log("\n🎉 All collections swept.");
}

main().catch((err) => {
  console.error("🚨 Fatal:", err);
  process.exit(1);
});
