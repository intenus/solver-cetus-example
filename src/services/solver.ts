import { IGSSolution } from '@intenus/common';
import { config } from '../config';
import { IntentSubmittedEvent, SwapIntent } from '../types/intent';
import { fetchIntentFromWalrus } from '../utils/walrus';
import { CetusService } from './cetusService';
import { SolutionService } from './solutionService';

/**
 * SimpleSolver processes swap intents and generates solutions
 * This is a basic demo solver that shows the flow
 */
export class SimpleSolver {
  private processedIntents: Set<string> = new Set();
  private cetusService: CetusService;
  private solutionService: SolutionService;

  constructor() {
    this.cetusService = new CetusService();
    this.solutionService = new SolutionService();
  }

  /**
   * Process an IntentSubmitted event
   */
  async processIntent(event: IntentSubmittedEvent): Promise<void> {
    const intentId = event.parsedJson.intent_id;

    // Skip if already processed
    if (this.processedIntents.has(intentId)) {
      console.log(`Intent ${intentId} already processed, skipping`);
      return;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing new intent: ${intentId}`);
    console.log(`Submitter: ${event.parsedJson.submitter}`);
    console.log(`Blob ID: ${event.parsedJson.blob_id}`);
    console.log(`Fee: ${event.parsedJson.fee} MIST`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Fetch intent data from Walrus
      const intentData = await fetchIntentFromWalrus(event.parsedJson.blob_id);
      const swapIntent: SwapIntent = {
        intentId,
        submitter: event.parsedJson.submitter,
        blobId: event.parsedJson.blob_id,
        ...intentData,
      };

      console.log('Intent details:');
      console.log(`  Token In: ${swapIntent.tokenIn}`);
      console.log(`  Token Out: ${swapIntent.tokenOut}`);
      console.log(`  Amount In: ${swapIntent.amountIn}`);
      console.log(`  Min Amount Out: ${swapIntent.minAmountOut}`);
      console.log(`  Slippage: ${swapIntent.slippage * 100}%`);

      // Step 2: Find best swap route
      const solution = await this.findBestRoute(swapIntent);

      if (!solution) {
        console.log('❌ No profitable route found');
        return;
      }

      // Step 3: Submit solution
      await this.submitSolution(solution, intentId);

      // Mark as processed
      this.processedIntents.add(intentId);
      console.log(`✅ Successfully processed intent ${intentId}\n`);

    } catch (error) {
      console.error(`❌ Error processing intent ${intentId}:`, error);
    }
  }

  /**
   * Find the best swap route and build transaction bytes using Cetus Protocol
   */
  private async findBestRoute(intent: SwapIntent): Promise<IGSSolution | null> {
    console.log('\n🔍 Finding best swap route and building transaction bytes using Cetus...');

    try {
      // Build swap transaction bytes using Cetus Aggregator
      const swapTx = await this.cetusService.buildSwapTransactionBytes(
        intent.tokenIn,
        intent.tokenOut,
        intent.amountIn,
        intent.slippage
      );

      if (!swapTx) {
        console.log('❌ Failed to build swap transaction');
        return null;
      }

      const expectedOutput = swapTx.quote.amountOut;

      // Check if route meets minimum output requirement
      if (BigInt(expectedOutput) < BigInt(intent.minAmountOut)) {
        console.log('❌ Route does not meet minimum output requirement');
        console.log(`  Expected: ${expectedOutput}`);
        console.log(`  Minimum required: ${intent.minAmountOut}`);
        return null;
      }

      // Calculate profit
      const profit = BigInt(expectedOutput) - BigInt(intent.minAmountOut);
      const profitPercent = Number(profit * BigInt(10000) / BigInt(intent.minAmountOut)) / 100;

      console.log(`📊 Route analysis:`);
      console.log(`  Protocol: ${swapTx.quote.route[0].protocol}`);
      console.log(`  Pool: ${swapTx.poolId}`);
      console.log(`  Expected output: ${expectedOutput}`);
      console.log(`  Minimum required: ${intent.minAmountOut}`);
      console.log(`  Profit: ${profitPercent.toFixed(4)}%`);
      console.log(`  Price impact: ${swapTx.quote.priceImpact.toFixed(4)}%`);
      console.log(`  Fee: ${swapTx.quote.feeAmount}`);
      console.log(`  Transaction bytes: ${swapTx.txBytes.length} bytes`);

      // Check price impact (reject if too high)
      const maxPriceImpact = 5.0; // 5% max price impact
      if (swapTx.quote.priceImpact > maxPriceImpact) {
        console.log(`❌ Price impact ${swapTx.quote.priceImpact.toFixed(4)}% too high (max: ${maxPriceImpact}%)`);
        return null;
      }

      console.log('✅ Profitable route found and transaction bytes built!');

      // Return IGSSolution with transaction bytes
      return {
        solver_address: this.solutionService.getSolverAddress(),
        tx_bytes: swapTx.txBytes,
      };
    } catch (error) {
      console.error('Error finding route and building transaction:', error);
      return null;
    }
  }

  /**
   * Submit the solution to the Intenus protocol
   */
  private async submitSolution(solution: IGSSolution, intentId: string): Promise<void> {
    console.log('\n📤 Submitting solution...');

    try {
      // Submit using SolutionService
      const txDigest = await this.solutionService.submitSolution(solution, intentId);
      
      console.log(`✅ Solution submitted successfully!`);
      console.log(`  Transaction: ${txDigest}`);
      console.log(`  Intent ID: ${intentId}`);
      console.log(`  Solver: ${solution.solver_address}`);
      console.log(`  Transaction bytes: ${solution.tx_bytes.length} bytes`);

    } catch (error) {
      console.error('❌ Error submitting solution:', error);
      throw error;
    }
  }

  /**
   * Get solver statistics
   */
  async getStats() {
    const solutionStats = await this.solutionService.getStats();
    
    return {
      processedIntents: this.processedIntents.size,
      cetusStats: this.cetusService.getStats(),
      solutionStats,
    };
  }
}
