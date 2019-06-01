import { HandlerOptions, withUiHook } from "@zeit/integration-utils";
import { Actions } from "actions";
import { sureDeleteView } from "views/sureDelete";
import {
  ClientStateSetup,
  MetadataZeit,
  NewClusterConfig,
  ViewInfo,
} from "./models";
import { dashboardView, detailsView, setupView } from "./views";

async function getContent(options: HandlerOptions) {
  const { payload, zeitClient } = options;
  const { action } = payload;

  const metadata: MetadataZeit = await zeitClient.getMetadata();
  const viewInfo: ViewInfo = { metadata, zeitClient, payload };
  console.log("received action", action, payload);
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
  if (action === Actions.addCluster) {
    // Call AWS add cluster
    const clusterName = "movie database";
    metadata.clusters = metadata.clusters || [];
    metadata.clusters.push({
      ...metadata.setup!,
      clusterName,
      secretArn: "adada",
    });
    metadata.projectsConnected = metadata.projectsConnected || {};
    metadata.projectsConnected[clusterName] = [];
    await zeitClient.setMetadata(metadata);
  }
  if (action.startsWith(Actions.removeCluster)) {
    if (action.startsWith(Actions.removeClusterView)) {
      return sureDeleteView(viewInfo, action.split("/")[1]);
    }
    // Call AWS remove cluster
    const clusterName = action.split("/")[1];
    metadata.clusters = metadata.clusters!.filter(
      (cl) => cl.clusterName !== clusterName,
    );
    delete metadata.projectsConnected![clusterName];
    await zeitClient.setMetadata(metadata);
  }
  if (action.startsWith(Actions.detailsClusterView)) {
    // Call AWS remove cluster
    const clusterName = action.split("/")[1];
    return detailsView(viewInfo, clusterName);
  }
  if (action.startsWith(Actions.connectCluster)) {
    const clusterName = action.split("/")[1];
    const projectId = payload.projectId;
    if (projectId) {
      metadata.projectsConnected![clusterName].push(projectId);
      const connectingToCluster = metadata.clusters!.find(
        (c) => c.clusterName === clusterName,
      )!;
      const secretNameSecret = await zeitClient.ensureSecret(
        "aws-secret-access-key",
        connectingToCluster.awsSecretAccessKey,
      );
      const secretNameKeyId = await zeitClient.ensureSecret(
        "aws-access-key-id",
        connectingToCluster.awsAccessKeyId,
      );
      const secretNameSecretArn = await zeitClient.ensureSecret(
        "aws-access-key-id",
        connectingToCluster.secretArn,
      );
      const secretNameClusterName = await zeitClient.ensureSecret(
        "aws-access-key-id",
        connectingToCluster.clusterName,
      );
      await Promise.all([
        zeitClient.upsertEnv(
          projectId,
          "AWS_SECRET_ACCESS_KEY",
          secretNameSecret,
        ),
        zeitClient.upsertEnv(projectId, "AWS_ACCESS_KEY_ID", secretNameKeyId),
        zeitClient.upsertEnv(projectId, "SECRET_ARN", secretNameSecretArn),
        zeitClient.upsertEnv(projectId, "CLUSTER_NAME", secretNameClusterName),
      ]);
      await zeitClient.setMetadata(metadata);
    }
  }
  if (!metadata.setup || action === Actions.setupView) {
    return setupView(viewInfo, !!metadata.setup);
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
