import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { createRDS } from './rds'
import { createECS } from './ecs'
import { createVPC } from './vpc'

export class SpikenStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const vpc = createVPC(this)
    const { dbCredentials, dbInstance } = createRDS({ stack: this, vpc })
    createECS({
      stack: this,
      vpc,
      dbCredentials,
      dbInstance,
    })
  }
}
