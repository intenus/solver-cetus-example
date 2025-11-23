import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  sui: {
    network: process.env.SUI_NETWORK || 'testnet',
    graphqlUrl: process.env.SUI_GRAPHQL_URL || 'https://graphql.testnet.sui.io/graphql',
    rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
  },
  solver: {
    privateKey: process.env.SOLVER_PRIVATE_KEY || '',
    publicKey: process.env.SOLVER_PUBLIC_KEY || '',
  },
  get signer() {
    const privateKey = process.env.SOLVER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('SOLVER_PRIVATE_KEY is required');
    }
    return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(privateKey).secretKey);
  },
  intenus: {
    packageId: process.env.INTENUS_PACKAGE_ID || '0x993c7635b44582e9c47c589c759239d3e1ce787811af5bfa0056aa253caa394a',
  },
  cetus: {
    // Testnet CLMM contract address
    clmmPackageId: (process.env.SUI_NETWORK || 'testnet') === 'mainnet' 
      ? '0x25ebb9a7c50eb17b3fa9c5a30fb8b5ad8f97caaf4928943acbcff7153dfee5e3'
      : '0x6bbdf09f9fa0baa1524080a5b8991042e95061c4e1206217279aec51ba08edf7',
    // Testnet aggregator contract
    aggregatorPackageId: (process.env.SUI_NETWORK || 'testnet') === 'mainnet'
      ? '0x11451575c775a3e633437b827ecbc1eb51a5964b0302210b28f5b89880be21a2'
      : '0x1f5fa5c820f40d43fc47815ad06d95e40a1942ff72a732a92e8ef4aa8cde70a5',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
  },
  polling: {
    eventPollInterval: parseInt(process.env.EVENT_POLL_INTERVAL || '5000'),
  },
};

// Validate required configuration
export function validateConfig() {
  const errors: string[] = [];

  if (!config.solver.privateKey) {
    errors.push('SOLVER_PRIVATE_KEY is required');
  }

  if (!config.solver.publicKey) {
    errors.push('SOLVER_PUBLIC_KEY is required');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\nPlease check your .env file');
    return false;
  }

  return true;
}
