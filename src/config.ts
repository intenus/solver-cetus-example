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
    // CLMM contract addresses from GitHub (latest)
    // https://github.com/CetusProtocol/cetus-clmm-interface
    clmmPackageId: (process.env.SUI_NETWORK || 'testnet') === 'mainnet' 
      ? '0x75b2e9ecad34944b8d0c874e568c90db0cf9437f0d7392abfd4cb902972f3e40' // mainnet latest
      : '0xb2a1d27337788bda89d350703b8326952413bd94b35b9b573ac8401b9803d018', // testnet latest
    // Config object for CLMM
    configObjectId: (process.env.SUI_NETWORK || 'testnet') === 'mainnet'
      ? '0xf31b605d117f959b9730e8c07b08b856cb05143c5e81d5751c90d2979e82f599' // mainnet config
      : '0x88bb33e9eff2fccab980a0e4b43fc4572abd08f08304d47a20d3e4e99d94d159', // testnet config
    // Versioned object for CLMM
    versionedObjectId: (process.env.SUI_NETWORK || 'testnet') === 'mainnet'
      ? '0x05370b2d656612dd5759cbe80463de301e3b94a921dfc72dd9daa2ecdeb2d0a8' // mainnet versioned
      : '0xa710caae87b2129acc97fbb98ea7011e3137c3291b02c0fcce866d67d5d9e8d0', // testnet versioned
    // Default partner (if not using partner swap)
    defaultPartner: (process.env.SUI_NETWORK || 'testnet') === 'mainnet'
      ? '0x639b5e433da31739e800cd085f356e64cae222966d0f1b11bd9dc76b322ff58b'
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

console.log(config);