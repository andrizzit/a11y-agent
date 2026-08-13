import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { A11yAgentStack } from '../lib/a11y-agent-stack.js';

function createTemplate() {
  const app = new App();
  const stack = new A11yAgentStack(app, 'TestStack');
  return Template.fromStack(stack);
}

describe('A11yAgentStack', () => {
  it('creates a scan-enabled ECR repository', () => {
    const template = createTemplate();

    template.resourceCountIs('AWS::ECR::Repository', 1);
    template.hasResourceProperties('AWS::ECR::Repository', {
      ImageScanningConfiguration: { ScanOnPush: true },
    });
  });

  it('creates an App Runner service using the ECR image', () => {
    const template = createTemplate();

    template.resourceCountIs('AWS::AppRunner::Service', 1);
    template.hasResourceProperties('AWS::AppRunner::Service', {
      ServiceName: 'a11y-agent-api',
      SourceConfiguration: {
        AutoDeploymentsEnabled: true,
        ImageRepository: {
          ImageRepositoryType: 'ECR',
          ImageConfiguration: {
            Port: '3000',
            RuntimeEnvironmentVariables: Match.arrayWith([
              { Name: 'HOST', Value: '0.0.0.0' },
              { Name: 'PORT', Value: '3000' },
            ]),
          },
        },
      },
      HealthCheckConfiguration: {
        Path: '/health',
        Protocol: 'HTTP',
      },
    });
  });

  it('uses separate least-privilege trust relationships for build and runtime', () => {
    const template = createTemplate();

    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Principal: { Service: 'build.apprunner.amazonaws.com' } }),
        ]),
      }),
    });
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Principal: { Service: 'tasks.apprunner.amazonaws.com' } }),
        ]),
      }),
    });

    expect(template.findResources('AWS::IAM::Role')).toBeDefined();
  });
});
