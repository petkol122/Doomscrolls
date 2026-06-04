export enum EquipmentErrorCode {
  ITEM_NOT_FOUND = "ITEM_NOT_FOUND",
  ITEM_NOT_IN_INVENTORY = "ITEM_NOT_IN_INVENTORY",
  ITEM_NOT_EQUIPPABLE = "ITEM_NOT_EQUIPPABLE",
  SLOT_MISMATCH = "SLOT_MISMATCH",
  INVENTORY_FULL = "INVENTORY_FULL",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

const DEFAULT_EQUIPMENT_ERROR_MESSAGES: Record<EquipmentErrorCode, string> = {
  [EquipmentErrorCode.ITEM_NOT_FOUND]: "Item was not found",
  [EquipmentErrorCode.ITEM_NOT_IN_INVENTORY]: "Item is not in inventory",
  [EquipmentErrorCode.ITEM_NOT_EQUIPPABLE]: "Item cannot be equipped",
  [EquipmentErrorCode.SLOT_MISMATCH]: "Item cannot be equipped in this slot",
  [EquipmentErrorCode.INVENTORY_FULL]: "Inventory is full",
  [EquipmentErrorCode.INTERNAL_ERROR]: "Internal equipment error",
};

export class EquipmentError extends Error {
  public constructor(
    public readonly code: EquipmentErrorCode,
    message: string = DEFAULT_EQUIPMENT_ERROR_MESSAGES[code],
  ) {
    super(message);
    this.name = "EquipmentError";
  }
}