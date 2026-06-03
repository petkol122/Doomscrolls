import { assertValidContentRegistry, contentRegistry } from "@doomscrolls/content";
import type { ServerLogger } from "../config/logger";

export function validateContentOnStartup(logger: ServerLogger): void {
  try {
    assertValidContentRegistry(contentRegistry);
    logger.info("Content registry validation succeeded.");
  } catch (error) {
    logger.error({ err: error }, "Content registry validation failed.");
    throw error;
  }
}