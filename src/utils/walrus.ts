/**
 * Utility functions for interacting with Walrus storage using @intenus/walrus
 */

import { IntenusWalrusClient } from "@intenus/walrus";
import { config } from "../config";
import { IGSIntent, IGSIntentSchema, IGSSolution, IGSSolutionSchema } from "@intenus/common";
import { IntenusSealClient, decryptIntentData } from "@intenus/seal";

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

// Initialize SEAL client
let sealClient: IntenusSealClient | null = null;

function getSealClient(): IntenusSealClient {
  if (!sealClient) {
    sealClient = new IntenusSealClient({
      network: config.sui.network as "testnet" | "mainnet",
    });
  }
  return sealClient;
}

/**
 * Simple intent format expected by the solver
 */
export interface SimpleIntentFormat {
  type?: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  slippage: number;
  deadline?: number;
  user_address: string;
}

/**
 * Parse IGS Intent to simple swap format
 * Converts IGS (Intenus General Standard) format to our solver's expected format
 */
function parseIGSIntent(igsIntent: IGSIntent): SimpleIntentFormat {
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
    user_address: igsIntent.user_address,
  };
}

/**
 * Fetch intent data from Walrus storage with SEAL decryption
 * @param blobId - The blob ID to fetch
 * @param intentId - The intent ID for SEAL decryption (optional, required for encrypted intents)
 * @returns The decoded intent data in simple format
 */
export async function fetchIntentFromWalrus(blobId: string, intentId?: string): Promise<SimpleIntentFormat | null> {
  try {
    const client = getWalrusClient();
    if(blobId!=="0d3TbaEfYxKmqKKLrkh4G6p6NCQs9R-6v1mFP872sB8") return null;
    let blobData = await client.intents.fetch(blobId);

    if (!blobData) {
      throw new Error("Blob not found");
    }

    // Try to decrypt with SEAL if intentId is provided
    if (intentId) {
      try {
        console.log(`Attempting to decrypt intent ${intentId} with SEAL...`);
        const sealClientInstance = getSealClient();

        // Check if blobData is encrypted (it would be a Uint8Array)
        if (blobData instanceof Uint8Array) {
          const decryptedData = await decryptIntentData(
            sealClientInstance,
            blobData,
            intentId,
            config.signer
          );
          blobData = decryptedData;
          console.log(`Successfully decrypted intent ${intentId} with SEAL`);
        } else {
          console.log(`Intent ${intentId} is not encrypted, using raw data`);
        }
      } catch (decryptError) {
        console.warn(`SEAL decryption failed for intent ${intentId}, falling back to non-encrypted data:`, decryptError);
        // Continue with original blobData (fallback)
      }
    }

    const intentData = IGSIntentSchema.parse(blobData);

    if (intentData.igs_version) {
      return parseIGSIntent(intentData as IGSIntent);
    } else {
      // If not IGS format, assume it's already in simple format
      return intentData as unknown as SimpleIntentFormat;
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
