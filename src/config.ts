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
    name: process.env.SOLVER_NAME || 'SimpleSwapSolver',
    minProfit: parseFloat(process.env.SOLVER_MIN_PROFIT || '0.001'),
  },
  intenus: {
    packageId: process.env.INTENUS_PACKAGE_ID || '0x993c7635b44582e9c47c589c759239d3e1ce787811af5bfa0056aa253caa394a',
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
