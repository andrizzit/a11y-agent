#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import {
  A11yAgentStack,
  bedrockInferenceProfileIdForRegion,
} from '../lib/a11y-agent-stack.js';
import { ServiceImageStack } from '../lib/service-image-stack.js';

const app = new App();
const region = process.env.CDK_DEFAULT_REGION ?? 'us-east-1';
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region,
};

const bedrockInferenceProfileId = bedrockInferenceProfileIdForRegion(region);
const imageTag = app.node.tryGetContext('imageTag') as string | undefined;

const imageStack = new ServiceImageStack(app, 'A11yAgentImageStack', { env });

new A11yAgentStack(app, 'A11yAgentStack', {
  description: 'Infrastructure for the a11y-agent accessibility auditing service',
  env,
  bedrockInferenceProfileId,
  imageRepository: imageStack.repository,
  imageTag,
});
