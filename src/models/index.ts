import { UiHookPayload, ZeitClient } from "@zeit/integration-utils";

export interface ViewInfo {
  metadata: any;
  payload: UiHookPayload;
  zeitClient: ZeitClient;
}

export interface ClientState {
  accessKey: string;
  secret: string;
  region: string;
}
