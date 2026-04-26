import EventEmitter from 'node:events';
import fs from 'node:fs';
import { Tail } from 'tail';
import { logger } from '../logger.js';

export interface LogTailerEvents {
  line: (line: string) => void;
  rotated: () => void;
}

export class LogTailer extends EventEmitter {
  private tail: Tail | null = null;

  constructor(private logPath: string) {
    super();
  }

  start(): void {
    if (!fs.existsSync(this.logPath)) {
      logger.warn(`Log file does not exist yet: ${this.logPath} — will retry`);
      setTimeout(() => this.start(), 5000);
      return;
    }

    this.tail = new Tail(this.logPath, {
      follow: true,
      fromBeginning: false,
      useWatchFile: true,
      flushAtEOF: true,
    });

    this.tail.on('line', (line: string) => this.emit('line', line));
    this.tail.on('error', (err: Error) => {
      logger.error(`Log tail error: ${err.message}`);
    });

    logger.info(`Tailing ${this.logPath}`);
  }

  stop(): void {
    if (this.tail) {
      this.tail.unwatch();
      this.tail = null;
    }
  }
}
