import type { JobStore } from './store.js';
import { createMemoryStore } from './store-memory.js';
import { createDynamoDBStore } from './store-dynamodb.js';

export function createStore(): JobStore {
  const tableName = process.env.DYNAMODB_TABLE;

  if (!tableName) {
    console.log('DYNAMODB_TABLE not set — using in-memory store');
    return createMemoryStore();
  }

  const endpoint = process.env.DYNAMODB_ENDPOINT;
  const region = process.env.AWS_REGION ?? 'us-east-1';

  console.log(`Using DynamoDB store (table: ${tableName}, region: ${region}${endpoint ? ', endpoint: ' + endpoint : ''})`);
  return createDynamoDBStore({ tableName, region, endpoint });
}
