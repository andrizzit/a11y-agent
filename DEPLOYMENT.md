# Deployment Guide

This document covers how to deploy a11y-agent to AWS, configure environment variables, and optionally attach a custom domain.

## Prerequisites

- AWS account with access to App Runner, DynamoDB, S3, CloudFront, ECR, and Bedrock
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- Node.js 20+ and pnpm 11+
- Docker (for building the service image)

## Architecture Overview

The deployment consists of two CloudFormation stacks:

| Stack | Resources |
|-------|-----------|
| `A11yAgentImageStack` | ECR repository for container images |
| `A11yAgentStack` | App Runner service, DynamoDB table, S3 buckets, CloudFront distribution, IAM roles |

## GitHub Actions Configuration

Deployment is fully automated via the CI/CD pipelines in `.github/workflows/`.

### Required Repository Variables

Set these in **Settings → Secrets and variables → Actions → Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for OIDC-based deployment. Must have permission to deploy CDK stacks, push to ECR, and manage CloudFront/S3/DynamoDB/App Runner. | `arn:aws:iam::123456789012:role/GitHubActionsDeployRole` |
| `AWS_REGION` | AWS region for deployment. Must support Bedrock Claude Sonnet 4 (see supported regions below). Defaults to `us-east-1` if omitted. | `us-east-1` |

### OIDC Trust Policy

The deploy role must trust GitHub's OIDC provider. Minimal trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<OWNER>/a11y-agent:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

### Deploy Role Permissions

The role needs these managed policies or equivalent custom policies:

- `AWSCloudFormationFullAccess`
- `AmazonEC2ContainerRegistryFullAccess`
- `AWSAppRunnerFullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonS3FullAccess`
- `CloudFrontFullAccess`
- `IAMFullAccess` (for CDK-managed roles)
- `AWSCertificateManagerFullAccess` (only if using custom domain)
- `AmazonRoute53FullAccess` (only if using custom domain)

> **Tip:** For production, scope these down to the specific resource ARNs created by CDK.

## Custom Domain (Optional)

The web frontend can be served from a custom domain instead of the default `*.cloudfront.net` URL. This is entirely optional — omit the context values to use CloudFront's auto-generated domain.

### Setup

1. **Register or transfer** your domain to Route 53 (or create a hosted zone for a subdomain).

2. **Pass CDK context values** during deployment:

```bash
cdk deploy A11yAgentStack \
  --context domainName=a11y.example.com \
  --context hostedZoneId=Z1234567890ABC \
  --context hostedZoneName=example.com
```

Or add them to `infra/cdk.json`:

```json
{
  "context": {
    "domainName": "a11y.example.com",
    "hostedZoneId": "Z1234567890ABC",
    "hostedZoneName": "example.com"
  }
}
```

3. **For GitHub Actions**, update the deploy step to include context:

```yaml
- name: Deploy application stack
  run: >-
    pnpm --dir infra exec cdk deploy "$APP_STACK_NAME"
    --context "imageTag=$IMAGE_TAG"
    --context "domainName=a11y.example.com"
    --context "hostedZoneId=Z1234567890ABC"
    --context "hostedZoneName=example.com"
    --require-approval never
```

### What Gets Created

When domain context is provided, CDK additionally creates:

- **ACM Certificate** — DNS-validated via Route 53 (auto-creates validation CNAME records)
- **Route 53 A Record** — alias pointing `domainName` → CloudFront distribution
- **CloudFront alternate domain** — distribution responds to your domain

### Context Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `domainName` | Yes (for custom domain) | The FQDN for the web frontend (e.g., `a11y.example.com`) |
| `hostedZoneId` | Yes (for custom domain) | Route 53 hosted zone ID that owns the domain |
| `hostedZoneName` | Yes (for custom domain) | The zone's domain name (e.g., `example.com`) |
| `imageTag` | No | Container image tag (defaults to `latest`; CD pipeline passes the commit SHA) |

> **Note:** ACM certificates for CloudFront **must** be in `us-east-1`. If deploying to another region, the CDK stack must be deployed in `us-east-1` or use a cross-region certificate. The current setup works when the stack itself is in `us-east-1`.

## Supported Bedrock Regions

The agent uses Claude Sonnet 4 via geographic inference profiles. Supported deployment regions:

| Scope | Regions |
|-------|---------|
| US | us-east-1, us-east-2, us-west-1, us-west-2 |
| EU | eu-central-1, eu-north-1, eu-south-1, eu-south-2, eu-west-1, eu-west-3, il-central-1 |
| APAC | ap-northeast-1/2/3, ap-south-1/2, ap-southeast-1/2/4 |

## Local Development

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | Yes | AWS region for Bedrock calls |
| `AWS_PROFILE` | No | Named AWS CLI profile (or use default credential chain) |
| `BEDROCK_MODEL_ID` | No | Override the default Bedrock model ID |
| `DYNAMODB_TABLE` | No | DynamoDB table name (omit for in-memory store) |
| `DYNAMODB_ENDPOINT` | No | Local DynamoDB endpoint for development |
| `PORT` | No | API server port (default: 3000) |
| `HOST` | No | API server bind address (default: 0.0.0.0) |
| `API_KEYS` | No | Comma-separated API keys for auth (omit to disable) |
| `RATE_LIMIT_MAX` | No | Requests per minute per IP (default: 100) |

### Running Locally

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the API (requires AWS credentials for Bedrock)
cd packages/api && node dist/index.js

# Run the web dev server (proxies API calls)
cd packages/web && pnpm dev
```

### Running Tests

```bash
# All tests
pnpm test

# CDK synthesis tests
pnpm --filter @a11y-agent/infra test

# MCP server unit tests
pnpm --filter @a11y-agent/mcp-server test

# Web E2E tests (mocked, no AWS needed)
pnpm --filter @a11y-agent/web test
```

## Manual Deployment

For deploying outside of GitHub Actions:

```bash
# Configure AWS credentials
aws sso login --profile your-profile

# Build the project
pnpm install --frozen-lockfile
pnpm build

# Deploy image stack first
cd infra
pnpm exec cdk deploy A11yAgentImageStack --require-approval never

# Build and push Docker image
REPO_URI=$(aws cloudformation describe-stacks \
  --stack-name A11yAgentImageStack \
  --query "Stacks[0].Outputs[?OutputKey=='ImageRepositoryUri'].OutputValue" \
  --output text)
docker build --platform linux/amd64 -t "${REPO_URI}:manual" ..
docker push "${REPO_URI}:manual"

# Deploy application stack
pnpm exec cdk deploy A11yAgentStack --context imageTag=manual --require-approval never

# Upload web assets
WEB_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name A11yAgentStack \
  --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue" \
  --output text)
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name A11yAgentStack \
  --query "Stacks[0].Outputs[?OutputKey=='WebDistributionId'].OutputValue" \
  --output text)

aws s3 sync ../packages/web/dist "s3://${WEB_BUCKET}" --delete
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
```

## Teardown

To remove all deployed resources:

```bash
cd infra

# Remove application stack (retains DynamoDB table and S3 buckets by policy)
pnpm exec cdk destroy A11yAgentStack

# Remove image stack (retains ECR repository)
pnpm exec cdk destroy A11yAgentImageStack
```

> **Note:** DynamoDB tables, S3 buckets, and ECR repositories use `RemovalPolicy.RETAIN` — they are not deleted when the stack is destroyed. Delete them manually from the AWS console if needed.
