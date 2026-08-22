import { CfnOutput, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import { Repository, TagMutability } from 'aws-cdk-lib/aws-ecr';
import type { Construct } from 'constructs';

export class ServiceImageStack extends Stack {
  readonly repository: Repository;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.repository = new Repository(this, 'ServiceImageRepository', {
      imageScanOnPush: true,
      imageTagMutability: TagMutability.IMMUTABLE,
      lifecycleRules: [
        {
          description: 'Retain the 20 most recent deployment images',
          maxImageCount: 20,
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    Tags.of(this).add('Project', 'a11y-agent');
    Tags.of(this).add('ManagedBy', 'AWS CDK');

    new CfnOutput(this, 'ImageRepositoryUri', {
      description: 'ECR repository URI for the API and agent container image',
      value: this.repository.repositoryUri,
    });
  }
}
