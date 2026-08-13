#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { A11yAgentStack } from '../lib/a11y-agent-stack.js';

const app = new App();

new A11yAgentStack(app, 'A11yAgentStack', {
  description: 'Infrastructure for the a11y-agent accessibility auditing service',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
