export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Player {
  steamId: string;
  characterName: string;
  permissions: string[];
  connectedAt: number;
  lastKnownPosition?: Position;
  positionUpdatedAt?: number;
}

export interface TakaroPlayer {
  gameId: string;
  name: string;
  platformId: string;
  steamId: string;
}

export function toTakaroPlayer(p: Player): TakaroPlayer {
  return {
    gameId: p.steamId,
    name: p.characterName,
    platformId: `steam:${p.steamId}`,
    steamId: p.steamId,
  };
}
