import { SuiClient, SuiEvent, SuiEventFilter, EventId } from '@mysten/sui/client';
import { config } from '../config';
import { IntentSubmittedEvent } from '../types/intent';

type SuiEventsCursor = EventId | null | undefined;

type EventExecutionResult = {
  cursor: SuiEventsCursor;
  hasNextPage: boolean;
};

/**
 * EventListener listens for IntentSubmitted events using Sui Client polling
 * Based on official Sui documentation pattern
 */
export class EventListener {
  private client: SuiClient;
  private lastProcessedCursor: SuiEventsCursor = null;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private eventFilter: SuiEventFilter;

  constructor() {
    this.client = new SuiClient({
      url: config.sui.rpcUrl,
    });

    // Set up event filter for IntentSubmitted events
    this.eventFilter = {
      MoveEventModule: {
        module: 'registry',
        package: config.intenus.packageId,
      },
    };
  }

  /**
   * Start polling for new IntentSubmitted events
   */
  async start(onEvent: (event: IntentSubmittedEvent) => Promise<void>) {
    if (this.isRunning) {
      console.log('EventListener is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting event listener (polling every ${config.polling.eventPollInterval}ms)...`);

    // Start the event polling loop
    this.runEventJob(onEvent);
  }

  /**
   * Stop polling for events
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log('EventListener stopped');
  }

  /**
   * Execute event polling job using Sui Client
   */
  private async executeEventJob(onEvent: (event: IntentSubmittedEvent) => Promise<void>): Promise<EventExecutionResult> {
    try {
      console.log(`📡 Polling for IntentSubmitted events...`);

      // Query events from Sui network using client
      const { data, hasNextPage, nextCursor } = await this.client.queryEvents({
        query: this.eventFilter,
        cursor: this.lastProcessedCursor,
        order: 'ascending',
        limit: 50,
      });

      // Process each event
      for (const event of data) {
        const intentEvent = this.parseEvent(event);
        if (intentEvent) {
          await onEvent(intentEvent);
        }
      }

      // Update cursor if we got new data
      if (nextCursor && data.length > 0) {
        this.lastProcessedCursor = nextCursor;
        console.log(`✅ Processed ${data.length} new events`);
      }

      return {
        cursor: nextCursor,
        hasNextPage,
      };
    } catch (error) {
      console.error('Error fetching events from Sui:', error);
      return {
        cursor: this.lastProcessedCursor,
        hasNextPage: false,
      };
    }
  }

  /**
   * Run event polling job with automatic retry
   */
  private async runEventJob(onEvent: (event: IntentSubmittedEvent) => Promise<void>) {
    if (!this.isRunning) return;

    const result = await this.executeEventJob(onEvent);

    // Schedule next poll - immediate if there are more pages, otherwise wait for interval
    setTimeout(
      () => {
        this.runEventJob(onEvent);
      },
      result.hasNextPage ? 0 : config.polling.eventPollInterval,
    );
  }

  /**
   * Parse Sui event into IntentSubmittedEvent
   */
  private parseEvent(rawEvent: SuiEvent): IntentSubmittedEvent | null {
    try {
      // Check if this is an IntentSubmitted event
      if (!rawEvent.type.includes('IntentSubmitted')) {
        return null;
      }

      return {
        id: {
          txDigest: rawEvent.id.txDigest,
          eventSeq: rawEvent.id.eventSeq,
        },
        packageId: rawEvent.packageId,
        transactionModule: rawEvent.transactionModule,
        sender: rawEvent.sender,
        type: rawEvent.type,
        parsedJson: rawEvent.parsedJson as any,
        bcs: rawEvent.bcs,
        timestampMs: rawEvent.timestampMs || '',
      };
    } catch (error) {
      console.error('Error parsing event:', error);
      return null;
    }
  }

  /**
   * Get current listener status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastProcessedCursor: this.lastProcessedCursor,
      eventFilter: this.eventFilter,
    };
  }
}
