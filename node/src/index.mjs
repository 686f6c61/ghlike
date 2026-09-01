// API publica de ghlike para Node >= 22 (usa el WebSocket nativo, cero deps).
import { check, GhlikeError, NoSessionError, RepoNotFoundError, run, star, toggle, unstar } from './core.mjs';
import { findSessions } from './browsers.mjs';

export { check, findSessions, GhlikeError, NoSessionError, RepoNotFoundError, run, star, toggle, unstar };
export default { star, unstar, toggle, check, run, findSessions };
