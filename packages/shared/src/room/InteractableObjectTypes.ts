/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Shared types for world interactable objects (notice boards, doors, etc).
 *
 * For now, objects are simple static placeholders with:
 * - id (unique per room)
 * - type (object type identifier)
 * - label (human-readable name)
 * - x, y (world position)
 *
 * No loot, quests, dialogue trees, or rewards yet.
 */

export interface InteractableObject {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export type InteractableObjectType =
  | "notice_board"
  | "door"
  | "shrine"
  | "merchant";
