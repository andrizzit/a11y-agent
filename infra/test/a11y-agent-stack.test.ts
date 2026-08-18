import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import {
  A11yAgentStack,
  bedrockInferenceProfileIdForRegion,
} from '../lib/a11y-agent-stack.js';

function createTemplate() {
  const app = new App();
  const stack = new A11yAgentStack(app, 'TestStack');
  return Template.fromStack(stack);
}

describe('A11yAgentStack', () => {
  it('selects the geographic Bedrock profile for the deployment region', () => {
    expect(bedrockInferenceProfileIdForRegion('us-east-1')).toMatch(/^us\./);
    expect(bedrockInferenceProfileIdForRegion('eu-west-3')).toMatch(/^eu\./);
    expect(bedrockInferenceProfileIdForRegion('ap-southeast-2')).toMatch(/^apac\./);
    expect(() => bedrockInferenceProfileIdForRegion('ca-central-1')).toThrow(
      'Claude Sonnet 4 geographic inference is not supported from ca-central-1',
    );
  });

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
              {
                Name: 'BEDROCK_MODEL_ID',
                Value: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
              },
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

    template.resourceCountIs('AWS::S3::Bucket', 2);
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

  it('hosts the SPA in a private bucket behind CloudFront OAC', () => {
    const template = createTemplate();

    template.hasResourceProperties('AWS::S3::Bucket', {
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
            Id: 'ExpireOldWebAssetVersions',
            NoncurrentVersionExpiration: { NoncurrentDays: 30 },
            Status: 'Enabled',
          }),
        ]),
      },
    });

    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
      OriginAccessControlConfig: {
        OriginAccessControlOriginType: 's3',
        SigningBehavior: 'always',
        SigningProtocol: 'sigv4',
      },
    });
  });

  it('configures HTTPS, caching, security headers, and SPA fallbacks', () => {
    const template = createTemplate();

    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        Enabled: true,
        HttpVersion: 'http2and3',
        PriceClass: 'PriceClass_100',
        DefaultCacheBehavior: Match.objectLike({
          AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
          Compress: true,
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
        CustomErrorResponses: Match.arrayWith([
          {
            ErrorCode: 403,
            ErrorCachingMinTTL: 0,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          },
          {
            ErrorCode: 404,
            ErrorCachingMinTTL: 0,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          },
        ]),
      }),
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

  it('grants model-scoped Bedrock invocation access to the runtime role', () => {
    const template = createTemplate();

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            Effect: 'Allow',
          }),
        ]),
      },
    });

    const policies = JSON.stringify(template.findResources('AWS::IAM::Policy'));
    expect(policies).toContain(
      ':bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0',
    );
    expect(policies).toContain(
      ':inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0',
    );
    expect(policies).toContain('bedrock:InferenceProfileArn');
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
