import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from 'aws-cdk-lib';
import { CfnService } from 'aws-cdk-lib/aws-apprunner';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HttpVersion,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export class A11yAgentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const imageRepository = new Repository(this, 'ServiceImageRepository', {
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const ecrAccessRole = new Role(this, 'AppRunnerEcrAccessRole', {
      assumedBy: new ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppRunnerServicePolicyForECRAccess'),
      ],
    });

    // Runtime permissions such as Bedrock, DynamoDB, and S3 are added on later deployment days.
    const instanceRole = new Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'Runtime role for the a11y-agent API and agent worker',
    });

    const jobsTable = new Table(this, 'JobsTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const evidenceBucket = new Bucket(this, 'EvidenceBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          id: 'ExpireAuditEvidence',
          enabled: true,
          expiration: Duration.days(90),
          noncurrentVersionExpiration: Duration.days(30),
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const webBucket = new Bucket(this, 'WebBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          id: 'ExpireOldWebAssetVersions',
          enabled: true,
          noncurrentVersionExpiration: Duration.days(30),
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const webDistribution = new Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(webBucket),
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [403, 404].map(httpStatus => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0),
      })),
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_100,
    });

    jobsTable.grantReadWriteData(instanceRole);
    evidenceBucket.grantReadWrite(instanceRole);

    const service = new CfnService(this, 'ApiService', {
      serviceName: 'a11y-agent-api',
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: ecrAccessRole.roleArn,
        },
        autoDeploymentsEnabled: true,
        imageRepository: {
          imageIdentifier: `${imageRepository.repositoryUri}:latest`,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              { name: 'HOST', value: '0.0.0.0' },
              { name: 'PORT', value: '3000' },
              { name: 'AWS_REGION', value: this.region },
              { name: 'DYNAMODB_TABLE', value: jobsTable.tableName },
              { name: 'EVIDENCE_BUCKET', value: evidenceBucket.bucketName },
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu: '1 vCPU',
        memory: '2 GB',
        instanceRoleArn: instanceRole.roleArn,
      },
      healthCheckConfiguration: {
        path: '/health',
        protocol: 'HTTP',
        healthyThreshold: 1,
        unhealthyThreshold: 5,
        interval: Duration.seconds(10).toSeconds(),
        timeout: Duration.seconds(5).toSeconds(),
      },
    });

    service.node.addDependency(imageRepository, ecrAccessRole, instanceRole);

    Tags.of(this).add('Project', 'a11y-agent');
    Tags.of(this).add('ManagedBy', 'AWS CDK');

    new CfnOutput(this, 'ServiceUrl', {
      description: 'Public URL of the App Runner API service',
      value: `https://${service.attrServiceUrl}`,
    });

    new CfnOutput(this, 'ImageRepositoryUri', {
      description: 'ECR repository URI for the API and agent container image',
      value: imageRepository.repositoryUri,
    });

    new CfnOutput(this, 'JobsTableName', {
      description: 'DynamoDB table used to persist audit jobs and reports',
      value: jobsTable.tableName,
    });

    new CfnOutput(this, 'EvidenceBucketName', {
      description: 'Private S3 bucket used for screenshots and audit evidence',
      value: evidenceBucket.bucketName,
    });

    new CfnOutput(this, 'WebBucketName', {
      description: 'Private S3 bucket containing the React SPA assets',
      value: webBucket.bucketName,
    });

    new CfnOutput(this, 'WebDistributionId', {
      description: 'CloudFront distribution ID for cache invalidations',
      value: webDistribution.distributionId,
    });

    new CfnOutput(this, 'WebUrl', {
      description: 'HTTPS URL of the React SPA',
      value: `https://${webDistribution.distributionDomainName}`,
    });
  }
}
