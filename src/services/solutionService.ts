/**
 * Solution submission service using Intenus SDK
 * Handles building and submitting solutions to the Intenus protocol
 */

import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { IGSSolution } from '@intenus/common';
import { config } from '../config';
import { storeSolutionToWalrus } from '../utils/walrus';

/**
 * Service for submitting solutions to Intenus protocol
 */
export class SolutionService {
  private suiClient: SuiClient;
  private keypair: Ed25519Keypair;

  constructor() {
    // Initialize Sui client
    this.suiClient = new SuiClient({
      url: config.sui.rpcUrl,
    });

    // Initialize keypair from private key
    this.keypair = config.signer;

    console.log(`Solution service initialized for solver: ${this.keypair.getPublicKey().toSuiAddress()}`);
  }

  /**
   * Submit a solution to the Intenus protocol
   *
   * The solution contains transaction bytes that the USER will execute.
   * We submit this solution to Intenus protocol so it can be matched with the intent.
   */
  async submitSolution(solution: IGSSolution, intentId: string): Promise<string> {
    try {
      console.log(`📤 Submitting solution for intent: ${intentId}`);
      console.log(`  Solver address: ${solution.solver_address}`);
      console.log(`  Transaction bytes length: ${solution.tx_bytes.length} bytes`);

      // Step 1: Store solution data to Walrus
      console.log(`  📦 Storing solution to Walrus...`);
      const solutionBlobId = await storeSolutionToWalrus(solution);
      console.log(`  ✅ Solution blob ID: ${solutionBlobId}`);

      // Step 2: Build and submit solution transaction to Intenus
      console.log(`  📤 Submitting to Intenus protocol...`);
      const transaction = new Transaction();

      // Call Intenus protocol contract to submit solution
      transaction.moveCall({
        target: `${config.intenus.packageId}::solver::submit_solution`,
        arguments: [
          transaction.pure.string(intentId),
          transaction.pure.string(solutionBlobId),
          transaction.pure.address(solution.solver_address),
        ],
      });

      transaction.setGasBudget(10000000); // 0.01 SUI

      // Sign and execute the submission transaction
      const result = await this.suiClient.signAndExecuteTransaction({
        signer: this.keypair,
        transaction,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      if (result.effects?.status?.status === 'success') {
        console.log(`✅ Solution submitted successfully!`);
        console.log(`  Transaction: ${result.digest}`);
        console.log(`  Intent ID: ${intentId}`);
        console.log(`  Solution Blob ID: ${solutionBlobId}`);
        return result.digest;
      } else {
        throw new Error(`Transaction failed: ${result.effects?.status?.error}`);
      }
    } catch (error) {
      console.error('❌ Error submitting solution:', error);
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
