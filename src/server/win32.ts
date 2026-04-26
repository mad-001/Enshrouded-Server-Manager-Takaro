import { logger } from '../logger.js';

// Signal Enshrouded to shut down gracefully via CTRL_C_EVENT.
// Mirrors EnshroudedServerService.cs from Crazyloon/Enshrouded-Server-Manager
// and the SIGINT pattern from jsknnr/enshrouded-server's Docker entrypoint.
//
// On Linux/dev machines this is a no-op stub — koffi only loads kernel32 on Windows.

let kernel32: any = null;
let attachConsole: any = null;
let freeConsole: any = null;
let setConsoleCtrlHandler: any = null;
let generateConsoleCtrlEvent: any = null;

const CTRL_C_EVENT = 0;

function ensureLoaded(): boolean {
  if (process.platform !== 'win32') return false;
  if (kernel32) return true;
  try {
    const koffi = require('koffi');
    kernel32 = koffi.load('kernel32.dll');
    attachConsole = kernel32.func('__stdcall', 'AttachConsole', 'bool', ['uint32']);
    freeConsole = kernel32.func('__stdcall', 'FreeConsole', 'bool', []);
    setConsoleCtrlHandler = kernel32.func('__stdcall', 'SetConsoleCtrlHandler', 'bool', ['void*', 'bool']);
    generateConsoleCtrlEvent = kernel32.func('__stdcall', 'GenerateConsoleCtrlEvent', 'bool', ['uint32', 'uint32']);
    return true;
  } catch (err) {
    logger.error(`Failed to load kernel32 via koffi: ${(err as Error).message}`);
    return false;
  }
}

export function sendCtrlCToProcess(pid: number): boolean {
  if (!ensureLoaded()) {
    logger.warn(`sendCtrlCToProcess(${pid}): koffi not available — cannot signal on this platform`);
    return false;
  }

  freeConsole();

  if (!attachConsole(pid)) {
    logger.error(`AttachConsole(${pid}) failed — server may not have a console or PID is wrong`);
    return false;
  }

  // Prevent OUR process from being killed by the signal we're about to broadcast.
  setConsoleCtrlHandler(null, true);

  const sent = generateConsoleCtrlEvent(CTRL_C_EVENT, 0);
  if (!sent) {
    logger.error(`GenerateConsoleCtrlEvent failed for pid ${pid}`);
  } else {
    logger.info(`Sent CTRL_C_EVENT to pid ${pid}`);
  }

  // Restore handlers and detach. Order matters — release console after un-disabling.
  setConsoleCtrlHandler(null, false);
  freeConsole();

  return sent;
}
