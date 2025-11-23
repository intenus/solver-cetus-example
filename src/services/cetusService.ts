/**
 * Cetus Protocol integration service
 * Handles swap routing and transaction building using Cetus Aggregator SDK
 */

import { AggregatorClient } from "@cetusprotocol/aggregator-sdk";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import BN from "bn.js";
import { config } from "../config";
import { SwapRoute } from "../types/intent";

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  priceImpact: number;
  route: SwapRoute[];
}

export interface SwapTransactionBytes {
  txBytes: string;
  quote: SwapQuote;
  poolId: string;
}

/**
 * Service for interacting with Cetus Protocol via Aggregator SDK
 */
export class CetusService {
  private aggregatorClient: AggregatorClient;
  private suiClient: SuiClient;

  constructor() {
    this.suiClient = new SuiClient({ url: config.sui.rpcUrl });
    this.aggregatorClient = new AggregatorClient({
      client: this.suiClient,
    });
  }

  /**
   * Find the best swap route for given tokens
   */
  async findBestSwapRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippageTolerance: number = 0.01
  ): Promise<SwapQuote | null> {
    try {
      const routerResult = await this.aggregatorClient.findRouters({
        from: tokenIn,
        target: tokenOut,
        amount: new BN(amountIn),
        byAmountIn: true,
      });

      const paths = (routerResult as any).paths || (routerResult as any).routes || [];
      if (!routerResult || paths.length === 0) {
        return null;
      }

      const bestPath = paths[0];
      const estimatedAmountOut = new BN(
        bestPath.amount_out || bestPath.output_amount || "0"
      );

      const slippageMultiplier = 1 - slippageTolerance;
      const amountOutWithSlippage = estimatedAmountOut
        .muln(Math.floor(slippageMultiplier * 10000))
        .divn(10000);

      const poolId = bestPath.pools?.[0]?.pool_id || "";
      const feeAmount = bestPath.fee_amount || "0";

      const amountInBN = new BN(amountIn);
      const priceImpact = amountInBN.muln(100).div(estimatedAmountOut).toNumber() / 100;

      const route: SwapRoute = {
        protocol: "Cetus",
        poolId: poolId,
        tokenIn,
        tokenOut,
        amountIn,
        expectedOut: estimatedAmountOut.toString(),
      };

      return {
        amountIn,
        amountOut: amountOutWithSlippage.toString(),
        feeAmount: feeAmount.toString(),
        priceImpact: Math.max(0, priceImpact),
        route: [route],
      };
    } catch (error) {
      console.error("Error finding swap route:", error);
      return null;
    }
  }

  /**
   * Build swap transaction bytes using Cetus Aggregator SDK
   * Returns transaction bytes that can be used in solution submission
   *
   * IMPORTANT: The transaction is built with userAddress as sender,
   * because the user (intent submitter) will execute this transaction, not the solver.
   */
  async buildSwapTransactionBytes(
    userAddress: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippageTolerance: number = 0.01,
    inputCoinObjectId?: string
  ): Promise<SwapTransactionBytes | null> {
    try {
      const routerResult = await this.aggregatorClient.findRouters({
        from: tokenIn,
        target: tokenOut,
        amount: new BN(amountIn),
        byAmountIn: true,
      });

      const paths = (routerResult as any).paths || (routerResult as any).routes || [];
      if (!routerResult || paths.length === 0) {
        return null;
      }

      const router = routerResult;
      const txb = new Transaction();
      txb.setSender(userAddress);

      let inputCoin: any;
      if (inputCoinObjectId) {
        inputCoin = txb.object(inputCoinObjectId);
      } else {
        inputCoin = txb.splitCoins(txb.gas, [txb.pure.u64(amountIn)]);
      }

      const targetCoin = await this.aggregatorClient.routerSwap({
        router: router,
        txb,
        inputCoin,
        slippage: slippageTolerance,
      });

      txb.transferObjects([targetCoin], txb.pure.address(userAddress));
      txb.setGasBudget(10000000);

      const txBytes = await txb.build({ client: this.suiClient });
      const quote = await this.findBestSwapRoute(tokenIn, tokenOut, amountIn, slippageTolerance);

      if (!quote) {
        return null;
      }

      const txBytesBase64 = Buffer.from(txBytes).toString("base64");
      const poolId = quote.route[0]?.poolId || "";

      return {
        txBytes: txBytesBase64,
        quote,
        poolId,
      };
    } catch (error) {
      console.error("Error building swap transaction bytes:", error);
      return null;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      cachedPools: 0,
      lastCacheUpdate: new Date(0).toISOString(),
      cacheAge: Date.now(),
    };
  }
}
