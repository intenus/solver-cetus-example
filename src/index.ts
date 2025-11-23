import { SolverServer } from './server';
import { validateConfig } from './config';

/**
 * Main entry point for the Intenus Solver
 */
async function main() {
  console.log('Starting Intenus Simple Swap Solver...\n');

  // Validate configuration
  if (!validateConfig()) {
    console.error('\n❌ Configuration validation failed. Exiting...');
    process.exit(1);
  }

  // Create and start server
  const server = new SolverServer();

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start solver:', error);
    process.exit(1);
  }

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n\nShutting down gracefully...');
    server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run the solver
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
