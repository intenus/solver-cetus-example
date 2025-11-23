/**
 * Cetus Protocol integration service
 * Handles pool discovery, price calculation, and swap routing
 */

import { CetusClmmSDK } from '@cetusprotocol/sui-clmm-sdk';
import initCetusSDK, { Percentage, adjustForSlippage, d } from '@cetusprotocol/cetus-sui-clmm-sdk';
import { AggregatorClient } from '@cetusprotocol/aggregator-sdk';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import BN from 'bn.js';
import { config } from '../config';
import { SwapRoute } from '../types/intent';

export interface CetusPool {
  poolAddress: string;
  coinTypeA: string;
  coinTypeB: string;
  tickSpacing: number;
  feeRate: number;
  currentSqrtPrice: string;
  liquidity: string;
}

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
 * Service for interacting with Cetus Protocol
 * Builds transaction bytes for swap execution
 */
export class CetusService {
  private poolCache: Map<string, CetusPool> = new Map();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache
  private aggregatorClient: AggregatorClient;
  private suiClient: SuiClient;

  constructor() {
    this.aggregatorClient = new AggregatorClient({});
    this.suiClient = new SuiClient({ url: config.sui.rpcUrl });
    console.log(`Cetus Service initialized for ${config.sui.network}`);
    console.log(`Cetus CLMM Package: ${config.cetus.clmmPackageId}`);
    console.log(`Cetus Aggregator Package: ${config.cetus.aggregatorPackageId}`);
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
      console.log(`🔍 Finding swap route: ${tokenIn} -> ${tokenOut}`);
      console.log(`Amount in: ${amountIn}`);

      // Find pools that can handle this swap
      const pools = await this.findSwapPools(tokenIn, tokenOut);
      
      if (pools.length === 0) {
        console.log('❌ No pools found for this token pair');
        return null;
      }

      let bestQuote: SwapQuote | null = null;
      let bestAmountOut = new BN(0);

      // Check each pool for the best rate
      for (const pool of pools) {
        try {
          const quote = await this.getSwapQuote(pool, tokenIn, tokenOut, amountIn, slippageTolerance);
          
          if (quote && new BN(quote.amountOut).gt(bestAmountOut)) {
            bestAmountOut = new BN(quote.amountOut);
            bestQuote = quote;
          }
        } catch (error) {
          console.log(`⚠️ Error getting quote from pool ${pool.poolAddress}:`, error);
          continue;
        }
      }

      if (bestQuote) {
        console.log(`✅ Best route found: ${bestQuote.amountOut} ${tokenOut}`);
        console.log(`Price impact: ${bestQuote.priceImpact.toFixed(4)}%`);
      }

      return bestQuote;
    } catch (error) {
      console.error('Error finding swap route:', error);
      return null;
    }
  }

  /**
   * Build swap transaction bytes using Cetus Aggregator
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
      console.log(`🔨 Building swap transaction bytes: ${tokenIn} -> ${tokenOut}`);
      console.log(`Amount in: ${amountIn}, Slippage: ${slippageTolerance * 100}%`);

      // Find best route using aggregator
      const routerResult = await this.aggregatorClient.findRouters({
        from: tokenIn,
        target: tokenOut,
        amount: new BN(amountIn),
        byAmountIn: true,
      });

      // RouterDataV3 has 'paths' instead of 'routes' in v3
      const paths = (routerResult as any).paths || (routerResult as any).routes || [];
      if (!routerResult || paths.length === 0) {
        console.log('❌ No routes found');
        return null;
      }

      // Use the router result directly (v3 format)
      const router = routerResult;

      // Build transaction
      const txb = new Transaction();

      // ✅ CRITICAL: Set the user as the sender of this transaction
      // The user (intent submitter) will execute this transaction, not the solver
      txb.setSender(userAddress);
      console.log(`  Setting transaction sender to user: ${userAddress}`);

      // If input coin object ID is provided, use it; otherwise create a placeholder
      let inputCoin: any;
      if (inputCoinObjectId) {
        inputCoin = txb.object(inputCoinObjectId);
      } else {
        // For demo, we'll need to handle coin splitting
        // In production, this should come from the intent
        inputCoin = txb.splitCoins(txb.gas, [txb.pure.u64(amountIn)]);
      }

      // Build swap transaction using aggregator (v3 format)
      const targetCoin = await this.aggregatorClient.routerSwap({
        router: router,
        txb,
        inputCoin,
        slippage: slippageTolerance,
      });

      // ✅ Transfer output coin back to the user (intent submitter)
      txb.transferObjects([targetCoin], txb.pure.address(userAddress));
      console.log(`  Output coins will be transferred to user: ${userAddress}`);

      // Set gas budget
      txb.setGasBudget(10000000); // 0.01 SUI

      // ✅ Build transaction bytes properly with sender set
      // This creates proper transaction bytes that the user can execute
      const txBytes = await txb.build({ client: this.suiClient });

      // Get quote for return
      const quote = await this.findBestSwapRoute(tokenIn, tokenOut, amountIn, slippageTolerance);
      
      if (!quote) {
        return null;
      }

      const txBytesBase64 = Buffer.from(txBytes).toString('base64');
      console.log(`✅ Transaction bytes built successfully`);
      console.log(`Transaction size: ${txBytes.length} bytes`);

      return {
        txBytes: txBytesBase64,
        quote,
        poolId: quote.route[0]?.poolId || '',
      };
    } catch (error) {
      console.error('Error building swap transaction bytes:', error);
      return null;
    }
  }

  /**
   * Get swap quote using Cetus Aggregator SDK
   */
  private async getSwapQuote(
    pool: CetusPool,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippageTolerance: number
  ): Promise<SwapQuote | null> {
    try {
      // Use Aggregator SDK to get real quote
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

      // Get the best route (first path)
      const bestPath = paths[0];
      const estimatedAmountOut = new BN(bestPath.amount_out || bestPath.output_amount || '0');
      
      // Apply slippage protection
      const slippageMultiplier = 1 - slippageTolerance;
      const amountOutWithSlippage = estimatedAmountOut.muln(Math.floor(slippageMultiplier * 10000)).divn(10000);

      // Extract pool information from path
      const poolId = bestPath.pools?.[0]?.pool_id || pool.poolAddress;
      const feeAmount = bestPath.fee_amount || '0';
      
      // Calculate price impact (simplified - in production use more sophisticated calculation)
      const amountInBN = new BN(amountIn);
      const priceImpact = amountInBN.muln(100).div(estimatedAmountOut).toNumber() / 100;

      const route: SwapRoute = {
        protocol: 'Cetus',
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
      console.error('Error getting swap quote:', error);
      return null;
    }
  }

  /**
   * Find pools that support swapping between two tokens using Cetus Aggregator
   */
  private async findSwapPools(tokenIn: string, tokenOut: string): Promise<CetusPool[]> {
    try {
      // Use Aggregator to find routes - this will give us real pool information
      const routerResult = await this.aggregatorClient.findRouters({
        from: tokenIn,
        target: tokenOut,
        amount: new BN(1000000), // Use 1 token as base amount for discovery
        byAmountIn: true,
      });

      const paths = (routerResult as any).paths || (routerResult as any).routes || [];
      if (!routerResult || paths.length === 0) {
        console.log(`No pools found for ${tokenIn} -> ${tokenOut}`);
        return [];
      }

      // Extract pool information from router result
      const pools: CetusPool[] = [];
      
      // Router result contains path information with pool IDs
      // We'll extract the first pool from the best route
      const firstPath = paths[0];
      if (firstPath && firstPath.pools && firstPath.pools.length > 0) {
        for (const poolInfo of firstPath.pools) {
          pools.push({
            poolAddress: poolInfo.pool_id || poolInfo.address || '',
            coinTypeA: tokenIn,
            coinTypeB: tokenOut,
            tickSpacing: poolInfo.tick_spacing || 2,
            feeRate: poolInfo.fee_rate || 3000,
            currentSqrtPrice: poolInfo.current_sqrt_price || '0',
            liquidity: poolInfo.liquidity || '0',
          });
        }
      }

      // Cache discovered pools
      for (const pool of pools) {
        this.poolCache.set(pool.poolAddress, pool);
      }
      this.lastCacheUpdate = Date.now();

      console.log(`Found ${pools.length} pools for ${tokenIn} -> ${tokenOut}`);
      return pools;
    } catch (error) {
      console.error('Error finding swap pools:', error);
      return [];
    }
  }

  /**
   * Update pool cache with pools from Aggregator SDK
   * Pools are cached when queried, no pre-fetching needed
   */
  private async updatePoolCache(): Promise<void> {
    // Pool cache is now populated on-demand when findSwapPools is called
    // No need for pre-fetching since Aggregator SDK provides real-time pool discovery
    // This method is kept for compatibility but doesn't need to do anything
  }

  /**
   * Get token decimals (cached)
   */
  private async getTokenDecimals(coinType: string): Promise<number> {
    try {
      // Common token decimals - in production, fetch from chain
      const commonDecimals: { [key: string]: number } = {
        '0x2::sui::SUI': 9,
        '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': 6, // USDC
        '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN': 6, // USDT
        // Add more common tokens as needed
      };

      if (commonDecimals[coinType]) {
        return commonDecimals[coinType];
      }

      // For unknown tokens, assume 9 decimals (SUI standard)
      // In production, you should fetch this from the chain
      return 9;
    } catch (error) {
      console.error('Error getting token decimals:', error);
      return 9; // Default to 9
    }
  }

  /**
   * Calculate price impact percentage
   */
  private calculatePriceImpact(amountIn: BN, amountOut: BN, pool: CetusPool): number {
    try {
      // Simplified price impact calculation
      // In production, you'd want more sophisticated calculation
      const liquidity = new BN(pool.liquidity);
      
      if (liquidity.isZero()) {
        return 0;
      }

      // Price impact ≈ amountIn / liquidity * 100
      const impact = amountIn.mul(new BN(10000)).div(liquidity);
      return impact.toNumber() / 100; // Convert to percentage
    } catch (error) {
      console.error('Error calculating price impact:', error);
      return 0;
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      cachedPools: this.poolCache.size,
      lastCacheUpdate: new Date(this.lastCacheUpdate).toISOString(),
      cacheAge: Date.now() - this.lastCacheUpdate,
    };
  }
}
