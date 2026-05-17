import {
  applyPlatformClass,
  registerStateSubscriptions,
  renderApp,
} from './app-shell.js';
import { registerGlobalEvents } from './global-events.js';
import { startPlaybackEvents } from './playback-events.js';
import {
  registerAsyncSubscriptions,
  seedInitialState,
  startBootstrap,
} from './bootstrap.js';

export { suppressRender } from './app-shell.js';

applyPlatformClass();
registerStateSubscriptions();
registerAsyncSubscriptions();
registerGlobalEvents();
seedInitialState();
renderApp();
startPlaybackEvents();
startBootstrap();
