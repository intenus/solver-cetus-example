/**
 * Solution submission service using Intenus SDK
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { IGSSolution } from '@intenus/common';
import { config } from '../config';
import { storeSolutionToWalrus } from '../utils/walrus';

export class SolutionService {
  private suiClient: SuiClient;
  private keypair: typeof config.signer;

  constructor() {
    this.suiClient = new SuiClient({
      url: config.sui.rpcUrl,
    });
    this.keypair = config.signer;
  }

  /**
   * Submit a solution to the Intenus protocol
   */
  async submitSolution(solution: IGSSolution, intentId: string): Promise<string> {
    try {
      const solutionBlobId = await storeSolutionToWalrus(solution);

      const transaction = new Transaction();

      transaction.moveCall({
        target: `${config.intenus.packageId}::solver::submit_solution`,
        arguments: [
          transaction.pure.string(intentId),
          transaction.pure.string(solutionBlobId),
          transaction.pure.address(solution.solver_address),
        ],
      });

      transaction.setGasBudget(10000000);

      const result = await this.suiClient.signAndExecuteTransaction({
        signer: this.keypair,
        transaction,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      if (result.effects?.status?.status === 'success') {
        return result.digest;
      } else {
        throw new Error(`Transaction failed: ${result.effects?.status?.error}`);
      }
    } catch (error) {
      console.error('Error submitting solution:', error);
      throw error;
    }
  }

  /**
   * Get solver address
   */
  getSolverAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }

  /**
   * Check solver balance
   */
  async getSolverBalance(): Promise<string> {
    try {
      const balance = await this.suiClient.getBalance({
        owner: this.getSolverAddress(),
      });
      return balance.totalBalance;
    } catch (error) {
      console.error('Error getting solver balance:', error);
      return '0';
    }
  }

  /**
   * Get service statistics
   */
  async getStats() {
    const balance = await this.getSolverBalance();
    
    return {
      solverAddress: this.getSolverAddress(),
      balance: balance,
      network: config.sui.network,
      packageId: config.intenus.packageId,
    };
  }
}
