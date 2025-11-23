import { IGSSolution } from '@intenus/common';
import { config } from '../config';
import { IntentSubmittedEvent, SwapIntent } from '../types/intent';
import { fetchIntentFromWalrus } from '../utils/walrus';
import { CetusService } from './cetusService';
import { SolutionService } from './solutionService';

/**
 * SimpleSolver processes swap intents and generates solutions
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

    if (this.processedIntents.has(intentId)) {
      return;
    }

    try {
      const intentData = await fetchIntentFromWalrus(event.parsedJson.blob_id, intentId);
      const submitter = intentData?.user_address || event.parsedJson.submitter;

      console.log("Retrieved intent data:", intentData);
      if (!submitter) {
        throw new Error('User address is required');
      }

      if(!intentData) {
        return;
      }

      // If intentData does not follow IGS spec, return early or throw
      if (
        !intentData.tokenIn ||
        !intentData.tokenOut ||
        !intentData.amountIn ||
        !intentData.minAmountOut ||
        !intentData.slippage
      ) {
        console.error('Intent data does not follow IGS spec:', intentData);
        return;
      }

      const swapIntent: SwapIntent = {
        intentId,
        submitter,
        blobId: event.parsedJson.blob_id,
        tokenIn: intentData.tokenIn,
        tokenOut: intentData.tokenOut,
        amountIn: intentData.amountIn,
        minAmountOut: intentData.minAmountOut,
        slippage: intentData.slippage,
        deadline: intentData.deadline || (Date.now() + 600000), // Default 10 minutes
      };

      const solution = await this.findBestRoute(swapIntent);

      if (!solution) {
        return;
      }

      await this.submitSolution(solution, intentId);
      this.processedIntents.add(intentId);
    } catch (error) {
      console.error(`Error processing intent ${intentId}:`, error);
    }
  }

  /**
   * Find the best swap route and build transaction bytes using Cetus Protocol
   */
  private async findBestRoute(intent: SwapIntent): Promise<IGSSolution | null> {
    try {
      const swapTx = await this.cetusService.buildSwapTransactionBytes(
        intent.submitter,
        intent.tokenIn,
        intent.tokenOut,
        intent.amountIn,
        intent.slippage
      );

      if (!swapTx) {
        return null;
      }

      const expectedOutput = swapTx.quote.amountOut;

      if (BigInt(expectedOutput) < BigInt(intent.minAmountOut)) {
        return null;
      }

      const maxPriceImpact = 5.0;
      if (swapTx.quote.priceImpact > maxPriceImpact) {
        return null;
      }

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
    try {
      await this.solutionService.submitSolution(solution, intentId);
    } catch (error) {
      console.error('Error submitting solution:', error);
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