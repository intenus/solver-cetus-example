/**
 * Utility functions for interacting with Walrus storage using @intenus/walrus
 */

import { IntenusWalrusClient } from "@intenus/walrus";
import { config } from "../config";
import { IGSIntent, IGSIntentSchema, IGSSolution, IGSSolutionSchema } from "@intenus/common";
import { SwapIntent } from "../types/intent";

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
 * Parsed intent format for the solver
 */
export interface ParsedIntent {
  type: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  slippage: number;
  deadline: number;
  userAddress: string;
}

/**
 * Parse IGS Intent to simple swap format
 * Converts IGS (Intenus General Standard) format to our solver's expected format
 */
export function parseIGSIntent(igsIntent: IGSIntent): ParsedIntent {
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
 * Convert IGS Intent to SwapIntent format
 * @param igsIntent - The IGS intent to convert
 * @param intentId - The intent ID
 * @param submitter - The submitter address
 * @param blobId - The blob ID
 * @returns SwapIntent object for the solver
 */
export function convertIGSToSwapIntent(
  igsIntent: IGSIntent,
  intentId: string,
  submitter: string,
  blobId: string
): SwapIntent {
  const parsedIntent = parseIGSIntent(igsIntent);

  return {
    intentId,
    submitter,
    blobId,
    tokenIn: parsedIntent.tokenIn,
    tokenOut: parsedIntent.tokenOut,
    amountIn: parsedIntent.amountIn,
    minAmountOut: parsedIntent.minAmountOut,
    slippage: parsedIntent.slippage,
    deadline: parsedIntent.deadline,
  };
}

/**
 * Fetch intent data from Walrus storage
 * @param blobId - The blob ID to fetch
 * @returns The decoded IGS intent data
 */
export async function fetchIntentFromWalrus(blobId: string): Promise<IGSIntent | null> {
  try {
    const client = getWalrusClient();
    if(blobId!=="xS44PnntMps4La_G8rBXbV4jZ-FfYC1bfdkWWF_j_7M") return null;
    
    const blobData = await client.intents.fetch(blobId);

    if (!blobData) {
      throw new Error("Blob not found");
    }

    const intentData = IGSIntentSchema.parse(blobData);

    console.log("Received intent data:", intentData);

    return intentData;
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
