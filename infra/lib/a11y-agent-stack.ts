import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from 'aws-cdk-lib';
import { CfnService } from 'aws-cdk-lib/aws-apprunner';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
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
  }
}
