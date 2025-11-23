import express, { Request, Response } from "express";
import { config } from "./config";
import { EventListener } from "./services/eventListener";
import { SimpleSolver } from "./services/solver";

export class SolverServer {
  private app: express.Application;
  private eventListener: EventListener;
  private solver: SimpleSolver;

  constructor() {
    this.app = express();
    this.eventListener = new EventListener();
    this.solver = new SimpleSolver();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    this.app.use((req, _res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    });

    // Solver status endpoint
    this.app.get("/status", async (_req: Request, res: Response) => {
      try {
        const listenerStatus = this.eventListener.getStatus();
        const solverStats = await this.solver.getStats();

        res.json({
          listener: listenerStatus,
          solver: solverStats,
          config: {
            network: config.sui.network,
            packageId: config.intenus.packageId,
            pollInterval: config.polling.eventPollInterval,
          },
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get solver statistics
    this.app.get("/stats", async (_req: Request, res: Response) => {
      try {
        const stats = await this.solver.getStats();
        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual trigger for testing (optional)
    this.app.post(
      "/test/process-intent",
      async (req: Request, res: Response) => {
        try {
          const { event } = req.body;

          if (!event) {
            return res.status(400).json({ error: "Event data is required" });
          }

          await this.solver.processIntent(event);
          res.json({ success: true, message: "Intent processed" });
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: "Not found" });
    });
  }

  /**
   * Start the solver server and event listener
   */
  async start() {
    return new Promise<void>((resolve) => {
      // Start HTTP server
      this.app.listen(config.server.port, () => {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`${"=".repeat(60)}`);
        console.log(`📡 Server running on port ${config.server.port}`);
        console.log(`🌐 Network: ${config.sui.network}`);
        console.log(`📦 Package ID: ${config.intenus.packageId}`);
        console.log(`⏱️  Poll interval: ${config.polling.eventPollInterval}ms`);
        console.log(`${"=".repeat(60)}\n`);

        // Start event listener
        this.eventListener.start(async (event) => {
          await this.solver.processIntent(event);
        });

        resolve();
      });
    });
  }

  /**
   * Stop the solver server
   */
  stop() {
    this.eventListener.stop();
    console.log("Solver server stopped");
  }
}
