import type { CharacterDetails, CharacterSummary } from "@doomscrolls/shared";
import type { FastifyInstance, FastifyPluginOptions, FastifyReply } from "fastify";
import { z } from "zod";
import { AuthService } from "../../auth/AuthService";
import { CharacterError, CharacterService, type CreateCharacterInput } from "../../character";
import {
  getHttpStatusFromCharacterError,
  mapCharacterErrorToHttpResponse,
} from "../errors/httpErrorMapper";
import { authenticateRequest } from "../middleware/authenticate";

const createCharacterBodySchema = z.object({
  characterName: z.string(),
  originId: z.string(),
  classId: z.string(),
});

const getCharacterParamsSchema = z.object({
  characterId: z.string(),
});

interface CharacterSummaryHttpDto extends Omit<CharacterSummary, "originKey" | "classKey"> {
  readonly originId: string;
  readonly classId: string;
}

interface CharacterDetailsHttpDto extends Omit<CharacterDetails, "originKey" | "classKey"> {
  readonly originId: string;
  readonly classId: string;
}

function toCharacterSummaryHttpDto(character: CharacterSummary): CharacterSummaryHttpDto {
  const { originKey: _originKey, classKey: _classKey, ...rest } = character;

  return {
    ...rest,
    originId: character.originKey,
    classId: character.classKey,
  };
}

function toCharacterDetailsHttpDto(character: CharacterDetails): CharacterDetailsHttpDto {
  const { originKey: _originKey, classKey: _classKey, ...rest } = character;

  return {
    ...rest,
    originId: character.originKey,
    classId: character.classKey,
  };
}

function sendUnknownError(reply: FastifyReply): void {
  void reply.code(500).send({
    error: "An internal error occurred",
    code: "INTERNAL_ERROR",
  });
}

/**
 * Register authenticated character HTTP routes.
 *
 * GET  /characters              - List the authenticated user's characters
 * GET  /characters/:characterId - Get one owned character's details
 * POST /characters              - Create a character for the authenticated user
 */
export async function registerCharacterRoutes(app: FastifyInstance, _options: FastifyPluginOptions): Promise<void> {
  const authService = new AuthService();
  const characterService = new CharacterService();

  app.post("/characters", async (request, reply) => {
    const account = await authenticateRequest(request, reply, authService);

    if (account === null) {
      return;
    }

    const parsed = createCharacterBodySchema.safeParse(request.body);

    if (!parsed.success) {
      void reply.code(400).send({
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    try {
      const input = parsed.data as CreateCharacterInput;
      const character = await characterService.createCharacter(account.user.id, input);
      void reply.code(201).send(toCharacterSummaryHttpDto(character));
    } catch (error: unknown) {
      if (error instanceof CharacterError) {
        void reply.code(getHttpStatusFromCharacterError(error)).send(mapCharacterErrorToHttpResponse(error));
        return;
      }

      sendUnknownError(reply);
    }
  });

  app.get("/characters", async (request, reply) => {
    const account = await authenticateRequest(request, reply, authService);

    if (account === null) {
      return;
    }

    try {
      const characters = await characterService.listCharacters(account.user.id);
      void reply.code(200).send({ characters: characters.map(toCharacterSummaryHttpDto) });
    } catch (error: unknown) {
      if (error instanceof CharacterError) {
        void reply.code(getHttpStatusFromCharacterError(error)).send(mapCharacterErrorToHttpResponse(error));
        return;
      }

      sendUnknownError(reply);
    }
  });

  app.get("/characters/:characterId", async (request, reply) => {
    const account = await authenticateRequest(request, reply, authService);

    if (account === null) {
      return;
    }

    const parsed = getCharacterParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      void reply.code(400).send({
        error: "Invalid route parameters",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    try {
      const character = await characterService.getCharacterForUser(parsed.data.characterId, account.user.id);
      void reply.code(200).send(toCharacterDetailsHttpDto(character));
    } catch (error: unknown) {
      if (error instanceof CharacterError) {
        void reply.code(getHttpStatusFromCharacterError(error)).send(mapCharacterErrorToHttpResponse(error));
        return;
      }

      sendUnknownError(reply);
    }
  });
}