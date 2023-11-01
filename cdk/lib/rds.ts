import * as cdk from 'aws-cdk-lib'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { SpikenStack } from './stack'

type CreateRdsProps = {
  stack: SpikenStack
  vpc: ec2.IVpc
}

export const createRDS = ({
  stack,
  vpc,
}: CreateRdsProps): {
  dbCredentials: secretsmanager.Secret
  dbInstance: rds.DatabaseInstance
} => {
  const dbSG = new ec2.SecurityGroup(stack, 'rdsSG', {
    vpc,
    allowAllOutbound: true,
  })

  dbSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(5432))

  const dbCredentials = new rds.DatabaseSecret(stack, 'rdsSecret', {
    username: process.env.DB_USER!,
  })

  const dbInstance = new rds.DatabaseInstance(stack, 'rdsInstance', {
    vpc,
    vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    instanceType: ec2.InstanceType.of(
      ec2.InstanceClass.T4G,
      ec2.InstanceSize.MICRO
    ),
    allocatedStorage: 20,
    engine: rds.DatabaseInstanceEngine.postgres({
      version: rds.PostgresEngineVersion.VER_15_4,
    }),
    port: 5432,
    securityGroups: [dbSG],
    credentials: rds.Credentials.fromSecret(dbCredentials),
    backupRetention: cdk.Duration.days(0),
    deleteAutomatedBackups: true,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  })

  return { dbCredentials, dbInstance }
}
