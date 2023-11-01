import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { SpikenStack } from './stack'

export const createVPC = (stack: SpikenStack): ec2.Vpc => {
  return new ec2.Vpc(stack, 'VPC', {
    cidr: '10.30.0.0/16',
    maxAzs: 3,
    subnetConfiguration: [
      {
        name: 'Public',
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 24,
      },
    ],
  })
}
