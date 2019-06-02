import { Actions } from "../actions";
import { MetadataZeit, ViewInfo } from "../models";

export const dashboardView = async (viewInfo: ViewInfo) => {
  const {
    clusters = [],
    projectsConnected = {},
  } = viewInfo.metadata as MetadataZeit;
  const currentProject = viewInfo.payload.projectId;
  return `
        <Box>
          <Fieldset>
            <FsContent>
              <FsTitle>AWS Aurora Dashboard</FsTitle>
              <FsSubtitle>Manage your Aurora clusters. Creation takes a minute or two so please wait for AWS do their thing, go grab a coffee?</FsSubtitle>
            </FsContent>
            <FsFooter>
              <Box marginRight="10px">
                <Button action="${Actions.setupView}">Change setup</Button>
              </Box>
              <Box>
                <Button action="${Actions.addCluster}">Add cluster</Button>
              </Box>
            </FsFooter>
          </Fieldset>
          ${
            clusters.length > 0
              ? ` <Fieldset>
            <FsContent>
              <FsTitle>Connect project to cluster</FsTitle>
              <FsSubtitle>Select a project to link it to one of your clusters - to unlink enter project details</FsSubtitle>
            </FsContent>
            <FsFooter>
              <Box width="100%">
                <ProjectSwitcher />
              </Box>
            </FsFooter>
          </Fieldset>`
              : ``
          }
          <Fieldset>
            <FsContent>
              <FsTitle>Clusters connected to this team</FsTitle>
            </FsContent>
            <FsFooter>
              <Box width="100%">
                ${clusters
                  .map(
                    (cl) => `
                  <Box display="flex" alignItems="center" padding="10px" border-bottom="1px solid #ddd">
                    <Box>
                    ${cl.clusterName}
                    </Box>
                    <Box marginLeft="auto">
                      <Button action="${Actions.detailsClusterView}/${
                      cl.clusterName
                    }">Details</Button>
                    </Box>
                    ${
                      currentProject
                        ? projectsConnected[cl.clusterName].includes(
                            currentProject,
                          )
                          ? `<Box marginLeft="10px">
                          <Button action="${Actions.connectCluster}/${
                              cl.clusterName
                            }">Update configuration</Button>
                        </Box>`
                          : `<Box marginLeft="10px">
                              <Button action="${Actions.connectCluster}/${
                              cl.clusterName
                            }">Link current project</Button>
                            </Box>`
                        : ""
                    }
                  </Box>
                `,
                  )
                  .join("\n")}
              </Box>
            </FsFooter>
          </Fieldset>
        </Box>
	`;
};
