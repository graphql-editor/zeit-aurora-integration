import AWSSDK, { RDSDataService, SecretsManager } from "aws-sdk";
import uuid from "uuid";
import { ClusterConfig, NewClusterConfig } from "../models";

export interface GlobalConfig {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
}

interface InternalClusterConfig {
  engine: string;
  engineMode: string;
  region: string;
  clusterName: string;
  user: string;
  password: string;
}

interface CreateClusterPayload {
  clusterName: string;
  clusterEndpoint: string;
}

interface CreateSecretPayload {
  secretArn: string;
}

export interface AWS {
  RDS: AWSSDK.RDS;
  SecretsManager: AWSSDK.SecretsManager;
}

function randomZeitClusterName(): string {
  return "zeit-" + uuid.v4();
}

function generatePassword() {
  const length = 12;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

export default class AwsClient {
  public awsSdk?: AWS;
  constructor(public cfg: GlobalConfig, awsSdk?: AWS) {
    this.awsSdk = awsSdk;
  }

  public async waitFor(rds: AWS.RDS, payload: CreateClusterPayload) {
    for (let i = 0; i < 30; i++) {
      try {
        await new Promise((resolved, rejected) => {
          rds.describeDBClusters(
            {
              DBClusterIdentifier: payload.clusterName,
            },
            (err, data) => {
              if (err) {
                rejected(err);
                return;
              }
              if (!data.DBClusters || data.DBClusters.length !== 1) {
                rejected(new Error("cluster not found"));
              }
              const dbClusters = data.DBClusters!;
              if (dbClusters[0].Status === "creating") {
                rejected(new Error("not ready"));
                return;
              }
              resolved("ok");
            },
          );
        });
        return;
      } catch (e) {
        if (e.message === "cluster not found") {
          throw e;
        }
      }
      await new Promise((resolved) =>
        setTimeout(() => resolved("ok"), 30 * 1000),
      );
    }
    throw new Error("timed out");
  }

  public createCluster(
    cfg: InternalClusterConfig,
  ): Promise<CreateClusterPayload> {
    const rds = this.awsSdk
      ? this.awsSdk.RDS
      : new AWSSDK.RDS({
          accessKeyId: this.cfg.awsAccessKeyId,
          region: cfg.region,
          secretAccessKey: this.cfg.awsSecretAccessKey,
        });
    return new Promise((resolved, rejected) => {
      rds.createDBCluster(
        {
          DBClusterIdentifier: cfg.clusterName,
          Engine: cfg.engine,
          EngineMode: cfg.engineMode,
          MasterUserPassword: cfg.password,
          MasterUsername: cfg.user,
        },
        (err, data) => {
          if (err) {
            rejected(err);
            return;
          }
          const dbcluster = data.DBCluster as { Endpoint: string };
          resolved({
            clusterEndpoint: dbcluster.Endpoint,
            clusterName: cfg.clusterName,
          });
        },
      );
    })
      .then(
        (v) =>
          new Promise(async (resolved, rejected) => {
            const cluster = v as CreateClusterPayload;
            try {
              await this.waitFor(rds, cluster);
              resolved(cluster);
            } catch (e) {
              rejected(e);
            }
          }),
      )
      .then(
        (v) =>
          new Promise((resolved, rejected) => {
            const cluster = v as CreateClusterPayload;
            rds.modifyDBCluster(
              {
                DBClusterIdentifier: cluster.clusterName,
                EnableHttpEndpoint: true,
              },
              (err, data) => {
                if (err) {
                  rejected(err);
                  return;
                }
                resolved(cluster);
              },
            );
          }),
      );
  }

  public createSecret(
    cfg: InternalClusterConfig,
    clusterPayload: CreateClusterPayload,
  ): Promise<CreateSecretPayload> {
    const secretsManager = this.awsSdk
      ? this.awsSdk.SecretsManager
      : new AWSSDK.SecretsManager({
          accessKeyId: this.cfg.awsAccessKeyId,
          region: cfg.region,
          secretAccessKey: this.cfg.awsSecretAccessKey,
        });
    return new Promise((resolved, rejected) => {
      secretsManager.createSecret(
        {
          Name: cfg.clusterName + "-secret",
          SecretString: JSON.stringify({
            dbClusterIdentifier: cfg.clusterName,
            engine: "mysql",
            host: clusterPayload.clusterEndpoint,
            password: cfg.password,
            username: cfg.user,
          }),
        },
        (err, data) => {
          if (err) {
            rejected(err);
            return;
          }
          resolved({
            secretArn: data.ARN!,
          });
        },
      );
    });
  }

  public async prepareCluster(cfg?: ClusterConfig): Promise<NewClusterConfig> {
    const {
      engine = "aurora",
      region = "us-east-1",
      engineMode = "serverless",
      clusterName = randomZeitClusterName(),
    } = cfg ? cfg : {};
    const user = "zeit";
    const password = generatePassword();
    const clusterCfg = {
      clusterName,
      engine,
      engineMode,
      password,
      region,
      user,
    };
    const clusterPayload = await this.createCluster(clusterCfg);
    const secretPayload = await this.createSecret(clusterCfg, clusterPayload);
    return {
      awsAccessKeyId: this.cfg.awsAccessKeyId,
      awsSecretAccessKey: this.cfg.awsSecretAccessKey,
      clusterName,
      region,
      secretArn: secretPayload.secretArn,
    };
  }
}
