import { createDoomscrollsGame } from "./game/DoomscrollsGame";
import { ApiClient } from "./net/ApiClient";
import { clientEnv } from "./config/env";

const GAME_CONTAINER_ID = "doomscrolls-game";

function reportConfiguredServerHealth(): void {
  if (clientEnv.apiUrl === undefined) {
    console.info("Doomscrolls API URL is not configured; skipping /health check.");
    return;
  }

  const apiClient = new ApiClient(clientEnv.apiUrl);

  void apiClient.getHealth().then((health) => {
    if (health.ok) {
      console.info(`Doomscrolls API health check succeeded with status ${health.status}.`);
      return;
    }

    console.warn("Doomscrolls API health check failed.", health);
  });
}

function main(): void {
  createDoomscrollsGame(GAME_CONTAINER_ID);
  reportConfiguredServerHealth();
}

main();
