import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { AuthService } from "../../auth/AuthService";
import { EquipmentError, EquipmentService } from "../../character";
import type { EquipmentSlot } from "@doomscrolls/shared";
import { authenticateRequest } from "../middleware/authenticate";
import { getHttpStatusFromEquipmentError, mapEquipmentErrorToHttpResponse } from "../errors/httpErrorMapper";

const equipItemBodySchema = z.object({
  characterId: z.string(),
  itemInstanceId: z.string(),
  slot: z.string(),
});

const unequipItemBodySchema = z.object({
  characterId: z.string(),
  slot: z.string(),
});

/**
 * Register equipment HTTP routes.
 *
 * POST /equip - Equip an inventory item into a character's equipment slot
 */
export async function registerEquipmentRoutes(app: FastifyInstance, _options: FastifyPluginOptions): Promise<void> {
  const authService = new AuthService();

  app.post("/equip", async (request, reply) => {
    const account = await authenticateRequest(request, reply, authService);

    if (account === null) {
      return;
    }

    const parsed = equipItemBodySchema.safeParse(request.body);

    if (!parsed.success) {
      void reply.code(400).send({
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const { characterId, itemInstanceId, slot } = parsed.data;
    const slotTyped = slot as EquipmentSlot;

    try {
      const equipmentService = new EquipmentService();
      await equipmentService.equip(characterId, account.user.id, itemInstanceId, slotTyped);
      void reply.code(200).send({ success: true });
    } catch (error: unknown) {
      if (error instanceof EquipmentError) {
        void reply.code(getHttpStatusFromEquipmentError(error)).send(mapEquipmentErrorToHttpResponse(error));
        return;
      }

      void reply.code(500).send({
        error: "An internal error occurred",
        code: "INTERNAL_ERROR",
      });
    }
  });

  app.post("/unequip", async (request, reply) => {
    const account = await authenticateRequest(request, reply, authService);

    if (account === null) {
      return;
    }

    const parsed = unequipItemBodySchema.safeParse(request.body);

    if (!parsed.success) {
      void reply.code(400).send({
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const { characterId, slot } = parsed.data;
    const slotTyped = slot as EquipmentSlot;

    try {
      const equipmentService = new EquipmentService();
      await equipmentService.unequip(characterId, account.user.id, slotTyped);
      void reply.code(200).send({ success: true });
    } catch (error: unknown) {
      if (error instanceof EquipmentError) {
        void reply.code(getHttpStatusFromEquipmentError(error)).send(mapEquipmentErrorToHttpResponse(error));
        return;
      }

      void reply.code(500).send({
        error: "An internal error occurred",
        code: "INTERNAL_ERROR",
      });
    }
  });
}