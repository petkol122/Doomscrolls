import { Client } from "@colyseus/sdk";

import { clientEnv } from "../config/env";

export type RealtimeClient = Client;

export function createRealtimeClient(wsUrl: URL = requireRealtimeWsUrl()): RealtimeClient {
  return new Client(wsUrl.toString());
}

function requireRealtimeWsUrl(): URL {
  if (clientEnv.wsUrl === undefined) {
    throw new Error("VITE_WS_URL is required to create a realtime client.");
  }

  return clientEnv.wsUrl;
}