import { Actions } from "../actions";
import { ViewInfo } from "../models";

export const sureDeleteView = async (
  viewInfo: ViewInfo,
  projectName: string,
) => {
  return `
        <Box>
          <Fieldset>
            <FsContent>
              <FsTitle>You are removing ${projectName} cluster.</FsTitle>
              <FsSubtitle>Are you sure?</FsSubtitle>
            </FsContent>
            <FsFooter>
                <Box marginRight="10px">
                    <Button action="${
                      Actions.dashobardView
                    }">No go back</Button>
                </Box>
                <Box>
                    <Button action="${
                      Actions.removeCluster
                    }/${projectName}">Yes</Button>
                </Box>
            </FsFooter>
          </Fieldset>
        </Box>
	`;
};
