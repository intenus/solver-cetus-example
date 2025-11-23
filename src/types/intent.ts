/**
 * Intent types for Intenus protocol
 */

export interface IntentSubmittedEvent {
  id: {
    txDigest: string;
    eventSeq: string;
  };
  packageId: string;
  transactionModule: string;
  sender: string;
  type: string;
  parsedJson: {
    intent_id: string;
    submitter: string;
    blob_id: string;
    access_start: string;
    access_end: string;
    auto_revoke_duration: string;
    fee: string;
    timestamp: string;
  };
  bcs: string;
  timestampMs: string;
}

export interface SwapIntent {
  intentId: string;
  submitter: string;
  blobId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  slippage: number;
  deadline: number;
}

export interface SwapRoute {
  protocol: string;
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedOut: string;
}
