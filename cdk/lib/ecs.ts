import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as rds from 'aws-cdk-lib/aws-rds'
import { SpikenStack } from './stack'

type CreateEcsProps = {
  stack: SpikenStack
  vpc: ec2.IVpc
  dbCredentials: secretsmanager.Secret
  dbInstance: rds.DatabaseInstance
}

export const createECS = ({
  stack,
  vpc,
  dbCredentials,
  dbInstance,
}: CreateEcsProps) => {
  const ecsSG = new ec2.SecurityGroup(stack, 'ecsSecurityGroup', {
    vpc,
    allowAllOutbound: true,
  })

  const cluster = new ecs.Cluster(stack, 'ecsCluster', {
    vpc: vpc,
  })

  const taskPolicy = new iam.ManagedPolicy(stack, 'ecsTaskPolicy', {
    statements: [
      // Allow access to RDS
      // TODO: Could potentially minimize the number of allowed actions
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dbqms:CreateFavoriteQuery',
          'dbqms:DescribeFavoriteQueries',
          'dbqms:UpdateFavoriteQuery',
          'dbqms:DeleteFavoriteQueries',
          'dbqms:GetQueryString',
          'dbqms:CreateQueryHistory',
          'dbqms:DescribeQueryHistory',
          'dbqms:UpdateQueryHistory',
          'dbqms:DeleteQueryHistory',
          'rds-data:ExecuteSql',
          'rds-data:ExecuteStatement',
          'rds-data:BatchExecuteStatement',
          'rds-data:BeginTransaction',
          'rds-data:CommitTransaction',
          'rds-data:RollbackTransaction',
          'secretsmanager:CreateSecret',
          'secretsmanager:ListSecrets',
          'secretsmanager:GetRandomPassword',
          'tag:GetResources',
        ],
        resources: [dbInstance.instanceArn],
      }),
    ],
  })

  const ecsRole = new iam.Role(stack, 'ecsRole', {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AmazonECSTaskExecutionRolePolicy'
      ),
    ],
  })

  ecsRole.addManagedPolicy(taskPolicy)

  const ecsExecRole = new iam.Role(stack, 'ecsEcecutionRole', {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AmazonECSTaskExecutionRolePolicy'
      ),
    ],
  })

  const ghcrSecret = new secretsmanager.Secret(stack, 'Secret', {
    secretStringValue: new cdk.SecretValue(process.env.GHCR_TOKEN!),
  })

  ghcrSecret.grantRead(ecsExecRole)
  dbInstance.secret?.grantRead(ecsExecRole)

  const taskDefinition = new ecs.TaskDefinition(stack, 'ecsTask', {
    compatibility: ecs.Compatibility.FARGATE,
    cpu: '256',
    memoryMiB: '512',
    networkMode: ecs.NetworkMode.AWS_VPC,
    taskRole: ecsRole,
    executionRole: ecsExecRole,
    runtimePlatform: {
      operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
    },
  })

  taskDefinition.addContainer('ecsContainer', {
    image: ecs.ContainerImage.fromRegistry(process.env.CONTAINER_URI!, {
      credentials: ghcrSecret,
    }),
    environment: {
      PGDATABASE: 'spiken',
      BOT_TOKEN: process.env.BOT_TOKEN!,
      CHAT_ID: process.env.CHAT_ID!,
      NODE_ENV: 'production',
    },
    secrets: {
      PGHOST: ecs.Secret.fromSecretsManager(dbCredentials, 'host'),
      PGPORT: ecs.Secret.fromSecretsManager(dbCredentials, 'port'),
      PGUSER: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
      PGPASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
    },
    logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'ecsLogs' }),
  })

  new ecs.FargateService(stack, 'ecsService', {
    cluster,
    taskDefinition,
    desiredCount: 1,
    securityGroups: [ecsSG],
    minHealthyPercent: 100,
    maxHealthyPercent: 200,
    assignPublicIp: true,
    enableExecuteCommand: true,
  })
}
