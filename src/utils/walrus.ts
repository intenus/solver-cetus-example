/**
 * Utility functions for interacting with Walrus storage using @intenus/walrus
 */

import { IntenusWalrusClient } from "@intenus/walrus";
import { config } from "../config";
import { IGSIntentSchema, IGSSolution, IGSSolutionSchema } from "@intenus/common";

// Initialize Walrus client
let walrusClient: IntenusWalrusClient | null = null;

function getWalrusClient(): IntenusWalrusClient {
  if (!walrusClient) {
    walrusClient = new IntenusWalrusClient({
      network: config.sui.network as "testnet" | "mainnet",
    });
  }
  return walrusClient;
}

/**
 * Fetch intent data from Walrus storage
 * @param blobId - The blob ID to fetch
 * @returns The decoded intent data
 */
export async function fetchIntentFromWalrus(blobId: string): Promise<any> {
  try {
    console.log(`📥 Fetching intent data from Walrus blob: ${blobId}`);

    const client = getWalrusClient();

    // Fetch the blob data
    const blobData = await client.intents.fetch(blobId);

    if (!blobData) {
      throw new Error("Blob not found");
    }

    // Parse the intent data
    // The intent should be in a standard format
    const intentData = IGSIntentSchema.parse(blobData);

    return intentData;
  } catch (error) {
    console.error(`❌ Error fetching from Walrus:`, error);

    // For demo purposes, return mock data if Walrus fails
    console.log("🔄 Using mock data for demo...");
    return {
      type: "swap",
      tokenIn: "0x2::sui::SUI",
      tokenOut:
        "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN", // USDC
      amountIn: "1000000000", // 1 SUI (9 decimals)
      minAmountOut: "1500000", // 1.5 USDC (6 decimals)
      slippage: 0.01, // 1%
      deadline: Date.now() + 600000, // 10 minutes from now
    };
  }
}

/**
 * Store solution data to Walrus
 * @param solution - The solution to store
 * @returns The blob ID
 */
export async function storeSolutionToWalrus(
  solution: IGSSolution
): Promise<string> {
  try {
    const client = getWalrusClient();

    // Store to Walrus
    const res = await client.solutions.store(solution, 3, config.signer);

    return res.blob_id;
  } catch (error) {
    console.error("❌ Error storing to Walrus:", error);

    // For demo purposes, return mock blob ID if Walrus fails
    const fakeBlobId = `demo_blob_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log(`🔄 Using mock blob ID for demo: ${fakeBlobId}`);
    return fakeBlobId;
  }
}
