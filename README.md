# Zeit now aurora integration

This is zeit.now integration for Aurora Data Http API

## How to use it

Create project with Zeit.

### Env variables

```
AURORA_SECRET_ACCESS_KEY
AURORA_ACCESS_KEY_ID
AURORA_SECRET_ARN
AURORA_CLUSTER_NAME
AURORA_CLUSTER_ARN
AURORA_REGION
```

```ts
import micro from "micro";
import AWS from "aws-sdk";

export default micro(async (req, res) => {
  const rdsDataService = new AWS.RDSDataService({
    accessKeyId: process.env.AURORA_ACCESS_KEY_ID,
    region: process.env.AURORA_REGION,
    secretAccessKey: process.env.AURORA_SECRET_ACCESS_KEY
  });

  const params = {
    secretArn: process.env.AURORA_SECRET_ARN!,
    resourceArn: process.env.AURORA_CLUSTER_ARN!,
    sql: `CREATE DATABASE cats`
  };

  // const params = {
  //   secretArn: process.env.AURORA_SECRET_ARN!,
  //   resourceArn: process.env.AURORA_CLUSTER_ARN!,
  //   sql: `SELECT * from cats where id=:id`,
  //   parameters: [
  //     {
  //       name: "id",
  //       value: {
  //         longValue: 1
  //       }
  //     }
  //   ]
  // };

  let data = await rdsDataService.executeStatement(params).promise();

  return "done";
});

```

## To be done

- [x] Setup with AWS keus
- [x] Add Aurora Cluster
- [x] Remove Aurora Cluster
- [x] Connect Aurora Cluster to project
- [x] Autogenerate cluster name
- [ ] Disconnect clusters from project
- [ ] Provide cluster with name and description
- [ ] Implement separate IAM Accounts for project runners