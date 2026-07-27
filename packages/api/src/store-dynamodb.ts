import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { Job, JobStore } from './store.js';

export interface DynamoDBStoreOptions {
  tableName: string;
  region?: string;
  endpoint?: string;
}

export function createDynamoDBStore(options: DynamoDBStoreOptions): JobStore {
  const { tableName, region = 'us-east-1', endpoint } = options;

  const client = new DynamoDBClient({
    region,
    ...(endpoint ? { endpoint } : {}),
  });
  const docClient = DynamoDBDocumentClient.from(client);

  return {
    async create(url) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const job: Job = { id, url, status: 'queued', createdAt: now, updatedAt: now };

      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: job,
      }));

      return job;
    },

    async get(id) {
      const result = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { id },
      }));
      return result.Item as Job | undefined;
    },

    async update(id, updates) {
      const now = new Date().toISOString();
      const fields = { ...updates, updatedAt: now };
      const keys = Object.keys(fields);

      if (keys.length === 0) return this.get(id);

      const expression = 'SET ' + keys.map((k, i) => `#k${i} = :v${i}`).join(', ');
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = {};

      for (let i = 0; i < keys.length; i++) {
        names[`#k${i}`] = keys[i];
        values[`:v${i}`] = fields[keys[i] as keyof typeof fields];
      }

      const result = await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: expression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }));

      return result.Attributes as Job | undefined;
    },

    async list() {
      const result = await docClient.send(new ScanCommand({
        TableName: tableName,
      }));
      const jobs = (result.Items ?? []) as Job[];
      return jobs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
  };
}
