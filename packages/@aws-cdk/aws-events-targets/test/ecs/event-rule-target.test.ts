import '@aws-cdk/assert/jest';
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import events = require('@aws-cdk/aws-events');
import cdk = require('@aws-cdk/core');
import targets = require('../../lib');

test("Can use EC2 taskdef as EventRule target", () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 1 });
  const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
  cluster.addCapacity('DefaultAutoScalingGroup', {
    instanceType: new ec2.InstanceType('t2.micro')
  });

  const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'TaskDef');
  taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('henk'),
    memoryLimitMiB: 256
  });

  const rule = new events.Rule(stack, 'Rule', {
    schedule: events.Schedule.expression('rate(1 min)')
  });

  // WHEN
  rule.addTarget(new targets.EcsTask({
    cluster,
    taskDefinition,
    taskCount: 1,
    containerOverrides: [{
      containerName: 'TheContainer',
      command: ['echo', events.EventField.fromPath('$.detail.event')],
    }]
  }));

  // THEN
  expect(stack).toHaveResourceLike('AWS::Events::Rule', {
    Targets: [
      {
        Arn: { "Fn::GetAtt": ["EcsCluster97242B84", "Arn"] },
        EcsParameters: {
          TaskCount: 1,
          TaskDefinitionArn: { Ref: "TaskDef54694570" }
        },
        InputTransformer: {
          InputPathsMap: {
            "detail-event": "$.detail.event"
          },
          InputTemplate: "{\"containerOverrides\":[{\"name\":\"TheContainer\",\"command\":[\"echo\",<detail-event>]}]}"
        },
        RoleArn: { "Fn::GetAtt": ["TaskDefEventsRoleFB3B67B8", "Arn"] },
        Id: "Target0"
      }
    ]
  });
});

test("Can use Fargate taskdef as EventRule target", () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 1 });
  const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });

  const taskDefinition = new ecs.FargateTaskDefinition(stack, 'TaskDef');
  taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('henk'),
  });

  const rule = new events.Rule(stack, 'Rule', {
    schedule: events.Schedule.expression('rate(1 min)')
  });

  // WHEN
  rule.addTarget(new targets.EcsTask({
    cluster,
    taskDefinition,
    taskCount: 1,
    containerOverrides: [{
      containerName: 'TheContainer',
      command: ['echo', events.EventField.fromPath('$.detail.event')],
    }]
  }));

  // THEN
  expect(stack).toHaveResourceLike('Custom::AWS', {
    Update: {
      service: "CloudWatchEvents",
      apiVersion: "2015-10-07",
      action: "putTargets",
      parameters: {
        Rule: {
          "Fn::Select": [
            1,
            {
              "Fn::Split": [
                "/",
                {
                  "Fn::Select": [
                    5,
                    {
                      "Fn::Split": [
                        ":",
                        {
                          "Fn::GetAtt": [
                            "Rule4C995B7F",
                            "Arn"
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        Targets: [
          {
            Arn: {
              "Fn::GetAtt": [
                "EcsCluster97242B84",
                "Arn"
              ]
            },
            Id: "Target0",
            EcsParameters: {
              TaskDefinitionArn: {
                Ref: "TaskDef54694570"
              },
              LaunchType: "FARGATE",
              NetworkConfiguration: {
                awsvpcConfiguration: {
                  Subnets: [
                    {
                      Ref: "VpcPrivateSubnet1Subnet536B997A"
                    }
                  ],
                  AssignPublicIp: "DISABLED",
                  SecurityGroups: [
                    {
                      "Fn::GetAtt": [
                        "TaskDefSecurityGroupD50E7CF0",
                        "GroupId"
                      ]
                    }
                  ]
                }
              },
              TaskCount: 1
            },
            Input: "{\"containerOverrides\":[{\"name\":\"TheContainer\",\"command\":[\"echo\",\"$.detail.event\"]}]}",
            RoleArn: {
              "Fn::GetAtt": [
                "TaskDefEventsRoleFB3B67B8",
                "Arn"
              ]
            }
          }
        ]
      },
      physicalResourceId: taskDefinition.node.uniqueId
    }
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Events::Rule', {
    Targets: [
      {
        Arn: { "Fn::GetAtt": ["EcsCluster97242B84", "Arn"] },
        EcsParameters: {
          TaskCount: 1,
          TaskDefinitionArn: { Ref: "TaskDef54694570" }
        },
        InputTransformer: {
          InputPathsMap: {
            "detail-event": "$.detail.event"
          },
          InputTemplate: "{\"containerOverrides\":[{\"name\":\"TheContainer\",\"command\":[\"echo\",<detail-event>]}]}"
        },
        RoleArn: { "Fn::GetAtt": ["TaskDefEventsRoleFB3B67B8", "Arn"] },
        Id: "Target0"
      }
    ]
  });
});

test("Can use same fargate taskdef with multiple rules", () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 1 });
  const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });

  const taskDefinition = new ecs.FargateTaskDefinition(stack, 'TaskDef');
  taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('henk'),
  });

  const scheduledRule = new events.Rule(stack, 'ScheduleRule', {
    schedule: events.Schedule.expression('rate(1 min)')
  });

  const patternRule = new events.Rule(stack, 'PatternRule', {
    eventPattern: {
      detail: ['test']
    }
  });

  scheduledRule.addTarget(new targets.EcsTask({
    cluster,
    taskDefinition,
  }));

  expect(() => patternRule.addTarget(new targets.EcsTask({
    cluster,
    taskDefinition
  }))).not.toThrow();
});

test("Can use same fargate taskdef multiple times in a rule", () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 1 });
  const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });

  const taskDefinition = new ecs.FargateTaskDefinition(stack, 'TaskDef');
  taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('henk'),
  });

  const rule = new events.Rule(stack, 'ScheduleRule', {
    schedule: events.Schedule.expression('rate(1 min)')
  });

  rule.addTarget(new targets.EcsTask({
    cluster,
    taskDefinition,
    containerOverrides: [{
      containerName: 'TheContainer',
      command: ['echo', events.EventField.fromPath('$.detail.a')],
    }]
  }));

  expect(() => rule.addTarget(new targets.EcsTask({
    cluster,
    taskDefinition,
    containerOverrides: [{
      containerName: 'TheContainer',
      command: ['echo', events.EventField.fromPath('$.detail.b')],
    }]
  }))).not.toThrow();
});

test("Isolated subnet does not have AssignPublicIp=true", () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'Vpc', {
    maxAzs: 1,
    subnetConfiguration: [{
      subnetType: ec2.SubnetType.ISOLATED,
      name: 'Isolated'
    }]
   });
  const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });

  const taskDefinition = new ecs.FargateTaskDefinition(stack, 'TaskDef');
  taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('henk'),
  });

  const rule = new events.Rule(stack, 'Rule', {
    schedule: events.Schedule.expression('rate(1 min)')
  });

  // WHEN
  rule.addTarget(new targets.EcsTask({
    cluster,
    taskDefinition,
    taskCount: 1,
    subnetSelection: { subnetType: ec2.SubnetType.ISOLATED },
    containerOverrides: [{
      containerName: 'TheContainer',
      command: ['echo', 'yay'],
    }]
  }));

  // THEN
  expect(stack).toHaveResourceLike('Custom::AWS', {
    Update: {
      service: "CloudWatchEvents",
      apiVersion: "2015-10-07",
      action: "putTargets",
      parameters: {
        Targets: [
          {
            EcsParameters: {
              LaunchType: "FARGATE",
              NetworkConfiguration: {
                awsvpcConfiguration: {
                  AssignPublicIp: "DISABLED",
                }
              },
            },
          }
        ]
      }
    }
  });
});