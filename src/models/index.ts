import { UiHookPayload, ZeitClient } from "@zeit/integration-utils";

export interface ViewInfo {
  metadata: any;
  payload: UiHookPayload;
  zeitClient: ZeitClient;
}

export interface ClientStateSetup {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  region: string;
}

export enum SetupVariables {
  awsAccessKeyId = "awsAccessKeyId",
  awsSecretAccessKey = "awsSecretAccessKey",
  region = "region",
}
export interface MetadataZeit {
  setup?: ClientStateSetup;
  clusters?: NewClusterConfig[];
  projectsConnected?: Record<string, string[]>;
}

export interface ClusterConfig {
  engine?: string;
  engineMode?: string;
  region?: string;
  clusterName?: string;
}

export interface NewClusterConfig {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  /**
   * This value is unique
   *
   * @type {string}
   * @memberof NewClusterConfig
   */
  clusterName: string;
  secretArn: string;
  region: string;
}
