import { GraphQLClient, gql } from 'graphql-request';
import { config } from '../config';
import { IntentSubmittedEvent } from '../types/intent';

/**
 * EventListener listens for IntentSubmitted events using GraphQL polling
 * Note: GraphQL subscriptions are not yet supported on Sui, so we use polling
 */
export class EventListener {
  private client: GraphQLClient;
  private lastProcessedCursor: string | null = null;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.client = new GraphQLClient(config.sui.graphqlUrl);
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

    // Initial fetch
    await this.pollEvents(onEvent);

    // Set up polling interval
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollEvents(onEvent);
      } catch (error) {
        console.error('Error polling events:', error);
      }
    }, config.polling.eventPollInterval);
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
   * Poll for new events using GraphQL query
   */
  private async pollEvents(onEvent: (event: IntentSubmittedEvent) => Promise<void>) {
    try {
      const query = gql`
        query GetIntentEvents($packageId: SuiAddress!, $after: String) {
          events(
            filter: {
              emittingPackage: $packageId
              eventType: "IntentSubmitted"
            }
            after: $after
            first: 50
          ) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              sendingModule {
                package {
                  address
                }
                name
              }
              sender {
                address
              }
              type {
                repr
              }
              json
              bcs
              timestamp
            }
          }
        }
      `;

      const variables = {
        packageId: config.intenus.packageId,
        after: this.lastProcessedCursor,
      };

      const data: any = await this.client.request(query, variables);

      if (data.events && data.events.nodes) {
        const events = data.events.nodes;

        for (const event of events) {
          // Parse and process each event
          const intentEvent = this.parseEvent(event);
          if (intentEvent) {
            await onEvent(intentEvent);
          }
        }

        // Update cursor for next poll
        if (data.events.pageInfo.endCursor) {
          this.lastProcessedCursor = data.events.pageInfo.endCursor;
        }

        if (events.length > 0) {
          console.log(`Processed ${events.length} new events`);
        }
      }
    } catch (error) {
      console.error('Error fetching events from GraphQL:', error);
      throw error;
    }
  }

  /**
   * Parse raw GraphQL event into IntentSubmittedEvent
   */
  private parseEvent(rawEvent: any): IntentSubmittedEvent | null {
    try {
      // Check if this is an IntentSubmitted event
      if (!rawEvent.type?.repr?.includes('IntentSubmitted')) {
        return null;
      }

      const parsedJson = typeof rawEvent.json === 'string'
        ? JSON.parse(rawEvent.json)
        : rawEvent.json;

      return {
        id: {
          txDigest: rawEvent.txDigest || '',
          eventSeq: rawEvent.eventSeq || '0',
        },
        packageId: rawEvent.sendingModule?.package?.address || config.intenus.packageId,
        transactionModule: rawEvent.sendingModule?.name || 'registry',
        sender: rawEvent.sender?.address || '',
        type: rawEvent.type?.repr || '',
        parsedJson: parsedJson,
        bcs: rawEvent.bcs || '',
        timestampMs: rawEvent.timestamp || '',
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
    };
  }
}
