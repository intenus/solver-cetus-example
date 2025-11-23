import { config } from '../config';
import { IntentSubmittedEvent, SwapIntent, Solution, SwapRoute } from '../types/intent';
import { fetchIntentFromWalrus, storeSolutionToWalrus } from '../utils/walrus';

/**
 * SimpleSolver processes swap intents and generates solutions
 * This is a basic demo solver that shows the flow
 */
export class SimpleSolver {
  private processedIntents: Set<string> = new Set();

  constructor() {
    console.log(`Initializing ${config.solver.name}...`);
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
      await this.submitSolution(solution);

      // Mark as processed
      this.processedIntents.add(intentId);
      console.log(`✅ Successfully processed intent ${intentId}\n`);

    } catch (error) {
      console.error(`❌ Error processing intent ${intentId}:`, error);
    }
  }

  /**
   * Find the best swap route for the intent
   * This is a simplified version - in production, you would:
   * 1. Query multiple DEXs (Cetus, Turbos, etc.)
   * 2. Calculate optimal routes
   * 3. Consider gas costs and profitability
   */
  private async findBestRoute(intent: SwapIntent): Promise<Solution | null> {
    console.log('\n🔍 Finding best swap route...');

    // Simulate route finding
    // In a real solver, you would:
    // - Query Cetus pools via their SDK
    // - Check other DEXs (Turbos, Aftermath, etc.)
    // - Calculate gas costs
    // - Optimize for best execution

    const route: SwapRoute[] = [
      {
        protocol: 'Cetus',
        poolId: '0x1234...example_pool', // Placeholder pool ID
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        amountIn: intent.amountIn,
        expectedOut: (BigInt(intent.minAmountOut) * BigInt(102) / BigInt(100)).toString(), // 2% better than minimum
      },
    ];

    const expectedOutput = route[route.length - 1].expectedOut;

    // Check if route meets minimum output requirement
    if (BigInt(expectedOutput) < BigInt(intent.minAmountOut)) {
      console.log('❌ Route does not meet minimum output requirement');
      return null;
    }

    // Calculate profit (simplified)
    const profit = (BigInt(expectedOutput) - BigInt(intent.minAmountOut)) / BigInt(intent.minAmountOut);
    const profitPercent = Number(profit) / 100;

    console.log(`📊 Route analysis:`);
    console.log(`  Protocol: ${route[0].protocol}`);
    console.log(`  Expected output: ${expectedOutput}`);
    console.log(`  Profit: ${profitPercent.toFixed(4)}%`);

    if (profitPercent < config.solver.minProfit) {
      console.log(`❌ Profit ${profitPercent.toFixed(4)}% below minimum ${config.solver.minProfit}%`);
      return null;
    }

    console.log('✅ Profitable route found!');

    return {
      intentId: intent.intentId,
      solverId: config.solver.publicKey,
      route,
      expectedOutput,
      gasEstimate: '1000000', // 0.001 SUI gas estimate
    };
  }

  /**
   * Submit the solution to the Intenus protocol
   * This uses the @intenus/solver-sdk to submit
   */
  private async submitSolution(solution: Solution): Promise<void> {
    console.log('\n📤 Submitting solution...');

    try {
      // Step 1: Store solution data to Walrus
      const solutionBlobId = await storeSolutionToWalrus({
        route: solution.route,
        expectedOutput: solution.expectedOutput,
        timestamp: Date.now(),
      });

      console.log(`  Solution blob ID: ${solutionBlobId}`);

      // Step 2: Submit solution to protocol
      // TODO: Use @intenus/solver-sdk to submit
      // const solutionBuilder = new SolutionBuilder();
      // const tx = await solutionBuilder
      //   .intentId(solution.intentId)
      //   .solutionBlob(solutionBlobId)
      //   .submit();

      console.log('  📝 Solution submitted (placeholder - implement SDK call)');
      console.log(`  Solution ID: solution_${Date.now()}`);

    } catch (error) {
      console.error('Error submitting solution:', error);
      throw error;
    }
  }

  /**
   * Get solver statistics
   */
  getStats() {
    return {
      processedIntents: this.processedIntents.size,
      solverName: config.solver.name,
      minProfit: config.solver.minProfit,
    };
  }
}
