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
  const input = igsIntent.operation.inputs[0];
  const output = igsIntent.operation.outputs[0];

  let amountIn: string;
  if (input.amount.type === 'exact') {
    amountIn = input.amount.value;
  } else if (input.amount.type === 'all') {
    throw new Error('Amount type "all" is not yet supported by this solver');
  } else if (input.amount.type === 'range') {
    amountIn = input.amount.min;
  } else {
    throw new Error(`Unknown amount type: ${(input.amount as any).type}`);
  }

  const minOutput = igsIntent.constraints?.min_outputs?.[0];
  const minAmountOut = minOutput?.amount || '0';

  const slippageBps = igsIntent.constraints?.max_slippage_bps || 100;
  const slippage = slippageBps / 10000;

  const deadline = igsIntent.constraints?.deadline_ms || (Date.now() + 600000);

  return {
    type: igsIntent.intent_type,
    tokenIn: input.asset_id,
    tokenOut: output.asset_id,
    amountIn,
    minAmountOut,
    slippage,
    deadline,
    userAddress: igsIntent.user_address,
  };
}

/**
 * Fetch intent data from Walrus storage
 * @param blobId - The blob ID to fetch
 * @returns The decoded intent data in simple format
 */
export async function fetchIntentFromWalrus(blobId: string): Promise<IGSIntent | null> {
  try {
    const client = getWalrusClient();
    if(blobId!=="0d3TbaEfYxKmqKKLrkh4G6p6NCQs9R-6v1mFP872sB8") return null;
    const blobData = await client.intents.fetch(blobId);
    
    if (!blobData) {
      throw new Error("Blob not found");
    }

    const intentData = IGSIntentSchema.parse(blobData);

    if (intentData.igs_version) {
      return parseIGSIntent(intentData as IGSIntent);
    } else {
      return intentData;
    }
  } catch (error) {
    console.error("Error fetching from Walrus:", error);
    throw error;
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
    const res = await client.solutions.store(solution, 3, config.signer);
    return res.blob_id;
  } catch (error) {
    console.error("Error storing to Walrus:", error);
    throw error;
  }
}
