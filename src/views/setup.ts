import { ClientState, ViewInfo } from "../models";

export const setupView = async (viewInfo: ViewInfo) => {
  const { payload, metadata, zeitClient } = viewInfo;
  const error = undefined;
  const { accessKey, region, secret } = payload.clientState as ClientState;
  const awsAccountCreationLink = "https://aws.amazon.com/account/";
  return `
		<Box>
			<Fieldset>
				<FsContent>
					<FsTitle>Create Your AWS Account</FsTitle>
					<FsSubtitle>Visit <Link href="${awsAccountCreationLink}" target="_blank">AWS</Link> and create an account.</FsSubtitle>
				</FsContent>
				<FsFooter>
					<P>If you already have an account, you can use that account instead.</P>
				</FsFooter>
			</Fieldset>
			<Fieldset>
				<FsContent>
					<FsTitle>Your AWS Access Key</FsTitle>
					<FsSubtitle>This is your AWS main access key. Don't worry this integration will create its own policies and doesnt store it.</FsSubtitle>
					<Input name="accessKey" value="${accessKey || ""}"/>
				</FsContent>
			</Fieldset>
			<Fieldset>
				<FsContent>
					<FsTitle>Your AWS Secret Key</FsTitle>
					<FsSubtitle>This is your AWS main secret key. Don't worry this integration will create its own policies and doesnt store it.</FsSubtitle>
					<Input name="secret" value="${secret || ""}"/>
				</FsContent>
			</Fieldset>
			<Fieldset>
				<FsContent>
					<FsTitle>Your AWS Region</FsTitle>
					<FsSubtitle>Aurora http api region( now only available in us-east-1</FsSubtitle>
					<Input name="region" value="${region || "us-east-1"}"/>
				</FsContent>
			</Fieldset>
			${
        error
          ? `
				<Box color="red" marginBottom="20px">${error}</Box>
			`
          : ""
      }
			<Button action="setup">Setup</Button>
		</Box>
	`;
};
