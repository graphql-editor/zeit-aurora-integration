import { HandlerOptions, htm, withUiHook } from "@zeit/integration-utils";
import { ViewInfo } from "./models";
import { setupView } from "./views";

async function getContent(options: HandlerOptions) {
  const { payload, zeitClient } = options;
  const { action } = payload;

  const metadata = await zeitClient.getMetadata();
  const viewInfo: ViewInfo = { metadata, zeitClient, payload };
  return setupView(viewInfo);
}

const handler = async (options: HandlerOptions): Promise<string> => {
  const content = await getContent(options);
  console.log(content);
  return htm`
          <Page>
            ${content}
          </Page>
      `;
};
export default withUiHook(handler);
