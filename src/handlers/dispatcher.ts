import { logger } from '../logger.js';
import type { GameServerAction, RequestPayload, WsMessage } from '../ws/protocol.js';
import type { TakaroWsClient } from '../ws/client.js';
import type { PlayerTracker } from '../players/tracker.js';
import type { ServerLifecycle } from '../server/lifecycle.js';
import type { BanManager } from '../bans/manager.js';
import type { SteamHashCache } from '../bans/cache.js';
import type { BackupService } from '../backup/service.js';
import { toTakaroPlayer } from '../players/types.js';

export interface HandlerContext {
  ws: TakaroWsClient;
  players: PlayerTracker;
  lifecycle: ServerLifecycle;
  bans: BanManager;
  steamHash: SteamHashCache;
  backups: BackupService;
}

type Handler = (args: any, ctx: HandlerContext, requestId: string) => Promise<unknown> | unknown;

export class HandlerDispatcher {
  private handlers: Partial<Record<GameServerAction, Handler>> = {};

  constructor(private ctx: HandlerContext) {}

  register(action: GameServerAction, handler: Handler): void {
    this.handlers[action] = handler;
  }

  async dispatch(msg: WsMessage): Promise<void> {
    const requestId = msg.requestId;
    if (!requestId) return;
    const payload = msg.payload as RequestPayload | undefined;
    if (!payload?.action) {
      this.ctx.ws.sendError(requestId, 'request payload missing action');
      return;
    }

    const handler = this.handlers[payload.action];
    if (!handler) {
      logger.debug(`No handler for action ${payload.action}; sending success:false`);
      this.ctx.ws.sendResponse(requestId, { success: false });
      return;
    }

    let parsedArgs: any = {};
    try {
      parsedArgs = payload.args ? JSON.parse(payload.args) : {};
    } catch (err) {
      this.ctx.ws.sendError(requestId, `bad JSON args: ${(err as Error).message}`);
      return;
    }

    try {
      const result = await handler(parsedArgs, this.ctx, requestId);
      this.ctx.ws.sendResponse(requestId, result);
    } catch (err) {
      logger.error(`Handler ${payload.action} threw: ${(err as Error).message}`);
      this.ctx.ws.sendError(requestId, (err as Error).message);
    }
  }
}

export { toTakaroPlayer };
