/**
 * Utility functions for interacting with Walrus storage using @intenus/walrus
 */

import { IntenusWalrusClient } from "@intenus/walrus";
import { config } from "../config";
import { IGSIntent, IGSIntentSchema, IGSSolution, IGSSolutionSchema } from "@intenus/common";

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
 * Parse IGS Intent to simple swap format
 * Converts IGS (Intenus General Standard) format to our solver's expected format
 */
function parseIGSIntent(igsIntent: IGSIntent): any {
  console.log(`📋 Parsing IGS Intent (version ${igsIntent.igs_version})...`);

  // Extract input and output from operation
  const input = igsIntent.operation.inputs[0];
  const output = igsIntent.operation.outputs[0];

  // Get amount from input
  let amountIn: string;
  if (input.amount.type === 'exact') {
    amountIn = input.amount.value;
  } else if (input.amount.type === 'all') {
    // For 'all', we'll need to query the user's balance
    // For now, use a default or throw error
    throw new Error('Amount type "all" is not yet supported by this solver');
  } else if (input.amount.type === 'range') {
    // For range, use the minimum
    amountIn = input.amount.min;
  } else {
    throw new Error(`Unknown amount type: ${(input.amount as any).type}`);
  }

  // Get minimum output from constraints
  const minOutput = igsIntent.constraints?.min_outputs?.[0];
  const minAmountOut = minOutput?.amount || '0';

  // Get slippage from constraints (convert from basis points to decimal)
  const slippageBps = igsIntent.constraints?.max_slippage_bps || 100; // Default 1%
  const slippage = slippageBps / 10000; // Convert basis points to decimal

  // Get deadline
  const deadline = igsIntent.constraints?.deadline_ms || (Date.now() + 600000);

  const parsed = {
    type: igsIntent.intent_type,
    tokenIn: input.asset_id,
    tokenOut: output.asset_id,
    amountIn,
    minAmountOut,
    slippage,
    deadline,
    userAddress: igsIntent.user_address,
  };

  console.log(`✅ Parsed IGS Intent:`, {
    tokenIn: parsed.tokenIn,
    tokenOut: parsed.tokenOut,
    amountIn: parsed.amountIn,
    minAmountOut: parsed.minAmountOut,
    slippage: `${slippage * 100}%`,
    userAddress: parsed.userAddress,
  });

  return parsed;
}

/**
 * Fetch intent data from Walrus storage
 * @param blobId - The blob ID to fetch
 * @returns The decoded intent data in simple format
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

    // Parse the intent data (should be IGS format)
    const intentData = IGSIntentSchema.parse(blobData);

    // Check if it's IGS format
    if (intentData.igs_version) {
      // Parse IGS format
      return parseIGSIntent(intentData as IGSIntent);
    } else {
      // Legacy simple format
      console.log(`✅ Successfully fetched intent data (legacy format):`, {
        type: intentData.intent_type,
        tokenIn: intentData.object.policy.inputs[0].asset_id,
        tokenOut: intentData.object.policy.outputs[0].asset_id,
        amountIn: intentData.object.policy.inputs[0].amount.value,
      });
      return intentData;
    }
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
