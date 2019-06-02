import { Actions } from "actions";
import { MetadataZeit, SetupVariables, ViewInfo } from "../models";

export const detailsView = async (viewInfo: ViewInfo, projectName: string) => {
  const { projectsConnected } = viewInfo.metadata as MetadataZeit;
  const projects = projectsConnected![projectName] || [];
  return `
        <Box>
          <Fieldset>
            <FsContent>
              <FsTitle>${projectName}</FsTitle>
              <FsSubtitle>Remove cluster from AWS and see connected projects</FsSubtitle>
            </FsContent>
            <FsFooter>
                <Box marginRight="10px">
                    <Button action="${Actions.dashobardView}">Back</Button>
                </Box>
                <Box>
                    <Button action="${
                      Actions.removeClusterView
                    }/${projectName}">Remove</Button>
                </Box>
            </FsFooter>
          </Fieldset>
          <Fieldset>
            <FsContent>
              <FsTitle>Projects connected to this cluster</FsTitle>
            </FsContent>
            <FsFooter>
              <Box width="100%">
                ${projects
                  .map(
                    (p) => `
                  <Box display="flex" alignItems="center" padding="10px" border-bottom="1px solid #ddd">
                    <Box>
                    ${p}
                    </Box>
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
