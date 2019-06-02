import AWSSDK from "aws-sdk";
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

interface CreateIAMPayload {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
}

interface CreateSecretPayload {
  secretArn: string;
}

export interface ClusterConfig {
  engine?: string;
  engineMode?: string;
  region?: string;
  clusterName?: string;
}

export interface RemoveClusterConfig {
  region?: string;
  finalSnapshot?: boolean;
  clusterName: string;
}

export interface NewClusterConfig {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  clusterName: string;
  secretArn: string;
  region: string;
}

export interface AWS {
  RDS: AWSSDK.RDS;
  SecretsManager: AWSSDK.SecretsManager;
}

function randomZeitClusterName(): string {
  return "zeit-" + uuid.v4();
}

function secretName(clusterName: string): string {
  return clusterName + "-secret";
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

  public async prepareCluster(cfg?: ClusterConfig) {
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
    const createIAMPayload = await this.createIAM(
      clusterCfg,
      clusterPayload,
      secretPayload,
    );
    const awsAccessKeyId = createIAMPayload.awsAccessKeyId
      ? createIAMPayload.awsAccessKeyId
      : this.cfg.awsAccessKeyId;
    const awsSecretAccessKey = createIAMPayload.awsSecretAccessKey
      ? createIAMPayload.awsSecretAccessKey
      : this.cfg.awsSecretAccessKey;
    return {
      awsAccessKeyId,
      awsSecretAccessKey,
      clusterName,
      region,
      secretArn: secretPayload.secretArn,
    };
  }

  public removeCluster(cfg: RemoveClusterConfig) {
    const { region = "us-east-1", finalSnapshot = false, clusterName } = cfg;
    const deleteClusterParams: AWSSDK.RDS.DeleteDBClusterMessage = {
      DBClusterIdentifier: clusterName,
      SkipFinalSnapshot: !finalSnapshot,
    };
    if (!deleteClusterParams.SkipFinalSnapshot) {
      deleteClusterParams.FinalDBSnapshotIdentifier =
        "snapshot-" + uuid.v4() + "-cluster-" + clusterName;
    }
    const deleteSecretParams: AWSSDK.SecretsManager.DeleteSecretRequest = {
      RecoveryWindowInDays: 7,
      SecretId: secretName(clusterName),
    };
    const rds = this.rds(region);
    const secretsManager = this.secretsManager(region);
    return new Promise((resolved, rejected) => {
      rds.deleteDBCluster(deleteClusterParams, (err) => {
        if (err) {
          rejected(err);
          return;
        }
        resolved("cluster " + clusterName + " deleted");
      });
    }).then(
      (v) =>
        new Promise((resolved, rejected) => {
          secretsManager.deleteSecret(deleteSecretParams, (err) => {
            if (err) {
              rejected(err);
              return;
            }
            resolved(v);
          });
        }),
    );
  }

  private rds(region: string): AWSSDK.RDS {
    return this.awsSdk
      ? this.awsSdk.RDS
      : new AWSSDK.RDS({
          accessKeyId: this.cfg.awsAccessKeyId,
          region,
          secretAccessKey: this.cfg.awsSecretAccessKey,
        });
  }

  private secretsManager(region: string): AWSSDK.SecretsManager {
    return this.awsSdk
      ? this.awsSdk.SecretsManager
      : new AWSSDK.SecretsManager({
          accessKeyId: this.cfg.awsAccessKeyId,
          region,
          secretAccessKey: this.cfg.awsSecretAccessKey,
        });
  }

  private createCluster(
    cfg: InternalClusterConfig,
  ): Promise<CreateClusterPayload> {
    const rds = this.rds(cfg.region);
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

  private createSecret(
    cfg: InternalClusterConfig,
    clusterPayload: CreateClusterPayload,
  ): Promise<CreateSecretPayload> {
    const secretsManager = this.secretsManager(cfg.region);
    return new Promise((resolved, rejected) => {
      secretsManager.createSecret(
        {
          Name: secretName(cfg.clusterName),
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

  private createIAM(
    cfg: ClusterConfig,
    clusterPayload: CreateClusterPayload,
    secretPayload: CreateSecretPayload,
  ): Promise<CreateIAMPayload> {
    // TODO: For each deployment create IAM service user with restricted ACL
    // user should only be allowed to access secrets
    return new Promise((resolved) => {
      resolved({
        awsAccessKeyId: "",
        awsSecretAccessKey: "",
      });
    });
  }
}
