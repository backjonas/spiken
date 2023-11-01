#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import 'dotenv/config'
import { SpikenStack } from '../lib/stack'

const app = new cdk.App()
new SpikenStack(app, 'SpikenStack', {
  env: {
    account: process.env.AWS_ACCOUNT_ID,
    region: process.env.AWS_REGION,
  },
})
