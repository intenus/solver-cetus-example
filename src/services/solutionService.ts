/**
 * Solution submission service using Intenus SDK
 * Handles building and submitting solutions to the Intenus protocol
 */

import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { IntenusProtocolClient } from '@intenus/client-sdk';
import { IGSSolution } from '@intenus/common';
import { config } from '../config';
import { storeSolutionToWalrus } from '../utils/walrus';

/**
 * Service for submitting solutions to Intenus protocol
 */
export class SolutionService {
  private suiClient: SuiClient;
  private keypair: Ed25519Keypair;
  private clientSDK: IntenusProtocolClient;

  constructor() {
    // Initialize Sui client
    this.suiClient = new SuiClient({
      url: config.sui.rpcUrl,
    });

    // Initialize keypair from private key
    this.keypair = config.signer;

    this.clientSDK = new IntenusProtocolClient({
      network: config.sui.network as 'testnet' | 'mainnet',
    })

    console.log(`Solution service initialized for solver: ${this.keypair.getPublicKey().toSuiAddress()}`);
  }

  /**
   * Submit a solution to the Intenus protocol
   */
  async submitSolution(solution: IGSSolution, intentId: string): Promise<string> {
    try {
      console.log(`📤 Submitting solution for intent: ${intentId}`);
      console.log(`  Transaction bytes length: ${solution.tx_bytes.length} bytes`);

      // Step 1: Store solution data to Walrus
      const solutionBlobId = await storeSolutionToWalrus(solution);

      console.log(`  📦 Solution blob ID: ${solutionBlobId}`);

      // Step 2: Build solution submission transaction
      const transaction = await this.buildSolutionTransaction(
        intentId,
        solutionBlobId,
        solution
      );

      // Step 3: Sign and execute transaction
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
   * Build solution transaction using appropriate SDK
   */
  private async buildSolutionTransaction(
    intentId: string,
    solutionBlobId: string,
    solution: IGSSolution
  ): Promise<Transaction> {
    try {
      // Build solution using manual transaction for now
      // TODO: Implement with actual Intenus SDK when available
      const transaction = new Transaction();
      
      // Manual move call to submit solution
      transaction.moveCall({
        target: `${config.intenus.packageId}::solver::submit_solution`,
        arguments: [
          transaction.pure.string(intentId),
          transaction.pure.string(solutionBlobId),
          transaction.pure.address(this.getSolverAddress()),
        ],
      });

      transaction.setGasBudget(10000000); // 0.01 SUI

      return transaction;
    } catch (error) {
      console.error('Error building solution transaction:', error);
      
      // Fallback: Use Client SDK if Solver SDK fails
      console.log('🔄 Falling back to Client SDK...');
      return this.buildFallbackTransaction(intentId, solutionBlobId, solution);
    }
  }

  /**
   * Fallback transaction builder using Client SDK
   */
  private async buildFallbackTransaction(
    intentId: string,
    solutionBlobId: string,
    solution: IGSSolution
  ): Promise<Transaction> {
    try {
      // Use manual transaction building as fallback
      return this.buildManualTransaction(intentId, solutionBlobId, solution);
    } catch (error) {
      console.error('Error building fallback transaction:', error);
      
      // Last resort: Manual transaction building
      console.log('🔄 Building manual transaction...');
      return this.buildManualTransaction(intentId, solutionBlobId, solution);
    }
  }

  /**
   * Manual transaction builder as last resort
   */
  private async buildManualTransaction(
    intentId: string,
    solutionBlobId: string,
    solution: IGSSolution
  ): Promise<Transaction> {
    const transaction = new Transaction();

    // Manual move call to submit solution
    // This is a placeholder - you'll need to adjust based on actual Intenus contract interface
    transaction.moveCall({
      target: `${config.intenus.packageId}::solver::submit_solution`,
      arguments: [
        transaction.pure.string(intentId),
        transaction.pure.string(solutionBlobId),
        transaction.pure.address(solution.solver_address),
      ],
    });

    transaction.setGasBudget(10000000); // 0.01 SUI

    return transaction;
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
