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
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
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
import type { IRepository } from 'aws-cdk-lib/aws-ecr';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

const BEDROCK_FOUNDATION_MODEL_ID = 'anthropic.claude-sonnet-4-20250514-v1:0';
const BEDROCK_PROFILE_SCOPE_BY_REGION: Readonly<Record<string, string>> = {
  'us-east-1': 'us',
  'us-east-2': 'us',
  'us-west-1': 'us',
  'us-west-2': 'us',
  'eu-central-1': 'eu',
  'eu-north-1': 'eu',
  'eu-south-1': 'eu',
  'eu-south-2': 'eu',
  'eu-west-1': 'eu',
  'eu-west-3': 'eu',
  'il-central-1': 'eu',
  'ap-northeast-1': 'apac',
  'ap-northeast-2': 'apac',
  'ap-northeast-3': 'apac',
  'ap-south-1': 'apac',
  'ap-south-2': 'apac',
  'ap-southeast-1': 'apac',
  'ap-southeast-2': 'apac',
  'ap-southeast-4': 'apac',
};

export function bedrockInferenceProfileIdForRegion(region: string): string {
  const scope = BEDROCK_PROFILE_SCOPE_BY_REGION[region];
  if (!scope) {
    throw new Error(`Claude Sonnet 4 geographic inference is not supported from ${region}`);
  }

  return `${scope}.${BEDROCK_FOUNDATION_MODEL_ID}`;
}

export interface A11yAgentStackProps extends StackProps {
  bedrockInferenceProfileId?: string;
  imageRepository: IRepository;
  imageTag?: string;
}

export class A11yAgentStack extends Stack {
  constructor(scope: Construct, id: string, props: A11yAgentStackProps) {
    super(scope, id, props);

    const bedrockInferenceProfileId = props.bedrockInferenceProfileId
      ?? `us.${BEDROCK_FOUNDATION_MODEL_ID}`;
    const imageTag = props.imageTag ?? 'latest';

    // --- Optional custom domain configuration (CDK context) ---
    const domainName = this.node.tryGetContext('domainName') as string | undefined;
    const hostedZoneId = this.node.tryGetContext('hostedZoneId') as string | undefined;
    const hostedZoneName = this.node.tryGetContext('hostedZoneName') as string | undefined;

    const ecrAccessRole = new Role(this, 'AppRunnerEcrAccessRole', {
      assumedBy: new ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppRunnerServicePolicyForECRAccess'),
      ],
    });

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

    // --- CloudFront distribution (with optional custom domain) ---
    let certificate: Certificate | undefined;
    let zone: ReturnType<typeof HostedZone.fromHostedZoneAttributes> | undefined;

    if (domainName && hostedZoneId && hostedZoneName) {
      zone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: hostedZoneName,
      });

      certificate = new Certificate(this, 'WebCertificate', {
        domainName,
        validation: CertificateValidation.fromDns(zone),
      });
    }

    const webDistribution = new Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      ...(domainName && certificate
        ? { domainNames: [domainName], certificate }
        : {}),
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

    // --- Route 53 alias record (only when custom domain is configured) ---
    if (domainName && zone) {
      new ARecord(this, 'WebAliasRecord', {
        zone,
        recordName: domainName,
        target: RecordTarget.fromAlias(new CloudFrontTarget(webDistribution)),
      });
    }

    jobsTable.grantReadWriteData(instanceRole);
    evidenceBucket.grantReadWrite(instanceRole);
    const bedrockInferenceProfileArn =
      `arn:${this.partition}:bedrock:${this.region}:${this.account}` +
      `:inference-profile/${bedrockInferenceProfileId}`;
    instanceRole.addToPolicy(
      new PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [bedrockInferenceProfileArn],
      }),
    );
    instanceRole.addToPolicy(
      new PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:${this.partition}:bedrock:*::foundation-model/${BEDROCK_FOUNDATION_MODEL_ID}`,
        ],
        conditions: {
          StringLike: {
            'bedrock:InferenceProfileArn': bedrockInferenceProfileArn,
          },
        },
      }),
    );

    const service = new CfnService(this, 'ApiService', {
      serviceName: 'a11y-agent-api',
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: ecrAccessRole.roleArn,
        },
        autoDeploymentsEnabled: true,
        imageRepository: {
          imageIdentifier: `${props.imageRepository.repositoryUri}:${imageTag}`,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              { name: 'HOST', value: '0.0.0.0' },
              { name: 'PORT', value: '3000' },
              { name: 'AWS_REGION', value: this.region },
              { name: 'BEDROCK_MODEL_ID', value: bedrockInferenceProfileId },
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

    service.node.addDependency(ecrAccessRole, instanceRole);

    Tags.of(this).add('Project', 'a11y-agent');
    Tags.of(this).add('ManagedBy', 'AWS CDK');

    new CfnOutput(this, 'ServiceUrl', {
      description: 'Public URL of the App Runner API service',
      value: `https://${service.attrServiceUrl}`,
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
      value: domainName
        ? `https://${domainName}`
        : `https://${webDistribution.distributionDomainName}`,
    });
  }
}
