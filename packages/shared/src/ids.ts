export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type UserId = Brand<string, "UserId">;
export type SessionId = Brand<string, "SessionId">;
export type SessionToken = Brand<string, "SessionToken">;
export type ProfileId = Brand<string, "ProfileId">;
export type CharacterId = Brand<string, "CharacterId">;
export type ItemDefinitionId = Brand<string, "ItemDefinitionId">;
export type ItemInstanceId = Brand<string, "ItemInstanceId">;
export type EntityId = Brand<string, "EntityId">;
export type RoomId = Brand<string, "RoomId">;
export type ZoneId = Brand<string, "ZoneId">;
export type CorpseId = Brand<string, "CorpseId">;
export type ContentId = Brand<string, "ContentId">;
export type SpawnPointId = Brand<string, "SpawnPointId">;

export type IsoDateTimeString = Brand<string, "IsoDateTimeString">;