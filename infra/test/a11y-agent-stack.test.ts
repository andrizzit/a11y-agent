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
              Match.objectLike({ Name: 'AWS_REGION' }),
              Match.objectLike({ Name: 'DYNAMODB_TABLE' }),
              Match.objectLike({ Name: 'EVIDENCE_BUCKET' }),
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

  it('creates an on-demand jobs table with recovery enabled', () => {
    const template = createTemplate();

    template.resourceCountIs('AWS::DynamoDB::Table', 1);
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
    });
  });

  it('creates a private encrypted evidence bucket with retention rules', () => {
    const template = createTemplate();

    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' },
          }),
        ]),
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      VersioningConfiguration: { Status: 'Enabled' },
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Id: 'ExpireAuditEvidence',
            ExpirationInDays: 90,
            NoncurrentVersionExpiration: { NoncurrentDays: 30 },
            Status: 'Enabled',
          }),
        ]),
      },
    });
  });

  it('grants the runtime role access to jobs and evidence only', () => {
    const template = createTemplate();

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
            ]),
            Effect: 'Allow',
          }),
          Match.objectLike({
            Action: Match.arrayWith(['s3:GetObject*', 's3:PutObject']),
            Effect: 'Allow',
          }),
        ]),
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
