import { HandlerOptions, withUiHook } from "@zeit/integration-utils";
import { Actions } from "./actions";
import AwsClient from "./client/aws-client";
import {
  ClientStateSetup,
  MetadataZeit,
  NewClusterConfig,
  ViewInfo,
} from "./models";
import { dashboardView, detailsView, setupView } from "./views";
import { sureDeleteView } from "./views/sureDelete";

async function getContent(options: HandlerOptions) {
  const { payload, zeitClient } = options;
  const { action } = payload;

  const metadata: MetadataZeit = await zeitClient.getMetadata();
  const viewInfo: ViewInfo = { metadata, zeitClient, payload };

  if (action === Actions.setup) {
    const {
      awsAccessKeyId,
      awsSecretAccessKey,
      region,
    } = payload.clientState as ClientStateSetup;
    metadata.setup = {
      awsAccessKeyId,
      awsSecretAccessKey,
      region,
    };
    await zeitClient.setMetadata(metadata);
  }
  if (!metadata.setup || action === Actions.setupView) {
    return setupView(viewInfo, !!metadata.setup);
  }
  const awsClient = new AwsClient({
    ...metadata.setup!,
  });
  if (action === Actions.addCluster) {
    const cluster = await awsClient.prepareCluster();
    metadata.clusters = metadata.clusters || [];
    metadata.clusters.push(cluster);
    metadata.projectsConnected = metadata.projectsConnected || {};
    metadata.projectsConnected[cluster.clusterName] = [];
    await zeitClient.setMetadata(metadata);
  }
  if (action.startsWith(Actions.removeCluster)) {
    if (action.startsWith(Actions.removeClusterView)) {
      return sureDeleteView(viewInfo, action.split("/")[1]);
    }
    const clusterName = action.split("/")[1];
    const removedCluster = metadata.clusters!.find(
      (cl) => cl.clusterName === clusterName,
    );
    metadata.clusters = metadata.clusters!.filter(
      (cl) => cl.clusterName !== clusterName,
    );
    const cluster = await awsClient.removeCluster({
      clusterName,
      region: removedCluster!.region,
    });
    delete metadata.projectsConnected![clusterName];
    await zeitClient.setMetadata(metadata);
  }
  if (action.startsWith(Actions.detailsClusterView)) {
    const clusterName = action.split("/")[1];
    return detailsView(viewInfo, clusterName);
  }
  if (action.startsWith(Actions.disconnectCluster)) {
    const clusterName = action.split("/")[1];
    metadata.projectsConnected![clusterName] = [];
    await zeitClient.setMetadata(metadata);
  }
  if (action.startsWith(Actions.connectCluster)) {
    const clusterName = action.split("/")[1];
    const projectId = payload.projectId;
    if (projectId) {
      metadata.projectsConnected![clusterName].push(projectId);
      const connectingToCluster = metadata.clusters!.find(
        (c) => c.clusterName === clusterName,
      )!;
      const [
        secretNameSecret,
        secretNameKeyId,
        secretNameSecretArn,
        secretNameClusterName,
        secretNameClusterARN,
        secretNameRegion,
      ] = await Promise.all([
        zeitClient.ensureSecret(
          "aurora-secret-access-key",
          connectingToCluster.awsSecretAccessKey,
        ),
        zeitClient.ensureSecret(
          "aurora-access-key-id",
          connectingToCluster.awsAccessKeyId,
        ),
        zeitClient.ensureSecret(
          "aurora-secret-arn",
          connectingToCluster.secretArn,
        ),
        zeitClient.ensureSecret(
          "aurora-cluster-name",
          connectingToCluster.clusterName,
        ),
        zeitClient.ensureSecret(
          "aurora-cluster-arn",
          connectingToCluster.clusterArn,
        ),
        zeitClient.ensureSecret("aurora-region", connectingToCluster.region),
      ]);
      await Promise.all([
        zeitClient.upsertEnv(
          projectId,
          "AURORA_SECRET_ACCESS_KEY",
          secretNameSecret,
        ),
        zeitClient.upsertEnv(
          projectId,
          "AURORA_ACCESS_KEY_ID",
          secretNameKeyId,
        ),
        zeitClient.upsertEnv(
          projectId,
          "AURORA_SECRET_ARN",
          secretNameSecretArn,
        ),
        zeitClient.upsertEnv(
          projectId,
          "AURORA_CLUSTER_NAME",
          secretNameClusterName,
        ),
        zeitClient.upsertEnv(
          projectId,
          "AURORA_CLUSTER_ARN",
          secretNameClusterARN,
        ),
        zeitClient.upsertEnv(projectId, "AURORA_REGION", secretNameRegion),
      ]);
      await zeitClient.setMetadata(metadata);
    }
  }
  return dashboardView(viewInfo);
}

const handler = async (options: HandlerOptions): Promise<string> => {
  return `
          <Page>
            ${await getContent(options)}
          </Page>
      `;
};
export default withUiHook(handler);
