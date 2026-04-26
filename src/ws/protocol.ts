// Mirrors packages/app-connector/src/lib/websocket.ts in the Takaro repo.

export type GameServerAction =
  | 'getPlayer'
  | 'getPlayers'
  | 'getPlayerLocation'
  | 'testReachability'
  | 'executeConsoleCommand'
  | 'listBans'
  | 'listItems'
  | 'listEntities'
  | 'listLocations'
  | 'getPlayerInventory'
  | 'getMapInfo'
  | 'getMapTile'
  | 'giveItem'
  | 'sendMessage'
  | 'teleportPlayer'
  | 'kickPlayer'
  | 'banPlayer'
  | 'unbanPlayer'
  | 'shutdown';

export interface WsMessage {
  type: 'identify' | 'identifyResponse' | 'connected' | 'gameEvent' | 'request' | 'response' | 'error' | 'ping' | 'pong';
  payload?: unknown;
  requestId?: string;
}

export interface IdentifyPayload {
  identityToken: string;
  registrationToken: string;
  name: string;
}

export interface RequestPayload {
  action: GameServerAction;
  args: string;
}

export interface CommandOutput {
  rawResult: string;
  success: boolean;
  errorMessage?: string;
}

export type GameEventType =
  | 'player-connected'
  | 'player-disconnected'
  | 'chat-message'
  | 'player-death'
  | 'entity-killed'
  | 'log';
