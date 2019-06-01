import AWSSDK, { RDSDataService, SecretsManager } from "aws-sdk"
import uuid from "uuid"

export interface GlobalConfig {
  awsAccessKeyId: string
  awsSecretAccessKey: string
}

interface clusterConfig {
  engine: string
  engineMode: string
  region: string
  clusterName: string
  user: string
  password: string
}

interface createClusterPayload {
  clusterName: string
  clusterEndpoint: string
}

interface createSecretPayload {
  secretArn: string
}

export interface ClusterConfig {
  engine?: string
  engineMode?: string
  region?: string
  clusterName?: string
}

export interface NewClusterConfig {
  awsAccessKeyId: string
  awsSecretAccessKey: string
  clusterName: string
  secretArn: string
  region: string
}

export interface AWS {
  RDS: AWSSDK.RDS
  SecretsManager: AWSSDK.SecretsManager
}

function randomZeitClusterName(): string {
  return "zeit-" + uuid.v4()
}

function generatePassword() {
  var length = 12,
    charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    retVal = "";
  for (var i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

export default class AwsClient {
  awsSdk?: AWS
  constructor(public cfg: GlobalConfig, awsSdk?: AWS) {
    this.awsSdk = awsSdk
  }

  async waitFor(rds: AWS.RDS, payload: createClusterPayload) {
    for (let i = 0; i < 30; i++) {
      try {
        await new Promise((resolved, rejected) => {
          rds.describeDBClusters({
            DBClusterIdentifier: payload.clusterName,
          }, (err, data) => {
            if (err) {
              rejected(err)
              return
            }
            if (!data.DBClusters || data.DBClusters.length !== 1) {
              rejected(new Error("cluster not found"))
            }
            const dbClusters = data.DBClusters!
            if (dbClusters[0].Status == "creating") {
              rejected(new Error("not ready"))
              return
            }
            resolved("ok")
          })
        })
        return
      } catch (e) {
        if (e.message == "cluster not found") {
          throw (e)
        }
      }
      await new Promise(resolved => setTimeout(() => resolved("ok"), 30 * 1000))
    }
    throw new Error("timed out")
  }

  createCluster(cfg: clusterConfig): Promise<createClusterPayload> {
    const rds = this.awsSdk ? this.awsSdk.RDS : new AWSSDK.RDS({
      accessKeyId: this.cfg.awsAccessKeyId,
      secretAccessKey: this.cfg.awsSecretAccessKey,
      region: cfg.region,
    })
    return new Promise((resolved, rejected) => {
      rds.createDBCluster({
        Engine: cfg.engine,
        DBClusterIdentifier: cfg.clusterName,
        EngineMode: cfg.engineMode,
        MasterUsername: cfg.user,
        MasterUserPassword: cfg.password,
      }, (err, data) => {
        if (err) {
          rejected(err)
          return
        }
        const dbcluster = data.DBCluster as { Endpoint: string }
        resolved({
          clusterName: cfg.clusterName,
          clusterEndpoint: dbcluster.Endpoint,
        })
      })
    }).then(v => new Promise(async (resolved, rejected) => {
      const cluster = v as createClusterPayload
      try {
        await this.waitFor(rds, cluster)
        resolved(cluster)
      } catch (e) {
        rejected(e)
      }
    })).then(v => new Promise((resolved, rejected) => {
      const cluster = v as createClusterPayload
      rds.modifyDBCluster({
        DBClusterIdentifier: cluster.clusterName,
        EnableHttpEndpoint: true,
      }, (err, data) => {
        if (err) {
          rejected(err)
          return
        }
        resolved(cluster)
      })
    }))
  }

  createSecret(cfg: clusterConfig, clusterPayload: createClusterPayload): Promise<createSecretPayload> {
    const secretsManager = this.awsSdk ? this.awsSdk.SecretsManager : new AWSSDK.SecretsManager({
      accessKeyId: this.cfg.awsAccessKeyId,
      secretAccessKey: this.cfg.awsSecretAccessKey,
      region: cfg.region,
    })
    return new Promise((resolved, rejected) => {
      secretsManager.createSecret({
        Name: cfg.clusterName + "-secret",
        SecretString: JSON.stringify({
          username: cfg.user,
          password: cfg.password,
          engine: "mysql",
          host: clusterPayload.clusterEndpoint,
          dbClusterIdentifier: cfg.clusterName,
        }),
      }, (err, data) => {
        if (err) {
          rejected(err)
          return
        }
        resolved({
          secretArn: data.ARN!,
        })
      })
    })
  }

  async prepareCluster(cfg?: ClusterConfig) {
    const {
      engine = "aurora",
      region = "us-east-1",
      engineMode = "serverless",
      clusterName = randomZeitClusterName()
    } = cfg ? cfg : {}
    const user = "zeit"
    const password = generatePassword()
    const clusterCfg = { engine, region, engineMode, clusterName, user, password }
    const clusterPayload = await this.createCluster(clusterCfg)
    const secretPayload = await this.createSecret(clusterCfg, clusterPayload)
    return {
      awsAccessKeyId: this.cfg.awsAccessKeyId,
      awsSecretAccessKey: this.cfg.awsSecretAccessKey,
      clusterName: clusterName,
      secretArn: secretPayload.secretArn,
      region: region
    }
  }
}
