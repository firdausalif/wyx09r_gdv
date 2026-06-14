import { getProxyPoolById } from "../../../models/index.js";
import { getSettings } from "../../db/repos/settingsRepo.js";

const RELAY_POOL_TYPES = new Set(["vercel", "cloudflare", "deno"]);
const VALID_PROXY_PREFIXES = ["http://", "https://", "socks4://", "socks5://"];

/**
 * Resolve a launchable proxy URL from bulk-import request body.
 *
 * Priority:
 *   1. proxyPoolId (lookup pool, reject relay types and inactive pools)
 *   2. proxyUrl (freeform, basic prefix validation)
 *   3. settings.useOutboundProxyForAutomation + settings.outboundProxyUrl fallback
 *
 * Returns { proxyUrl: string|null, error: string|null }.
 * When error is non-null the caller should respond with 400.
 */
export async function resolveBulkImportProxy({ proxyPoolId, proxyUrl } = {}) {
  if (proxyPoolId) {
    const pool = await getProxyPoolById(proxyPoolId);
    if (!pool) {
      return { proxyUrl: null, error: "Proxy pool not found" };
    }
    if (!pool.isActive) {
      return { proxyUrl: null, error: "Proxy pool is inactive" };
    }
    if (RELAY_POOL_TYPES.has(pool.type)) {
      return {
        proxyUrl: null,
        error: `Proxy pool type "${pool.type}" is a URL-rewriting relay and cannot be used for browser launch`,
      };
    }
    return { proxyUrl: pool.proxyUrl || null, error: null };
  }

  if (proxyUrl) {
    const trimmed = String(proxyUrl).trim();
    if (!trimmed) {
      return { proxyUrl: null, error: null };
    }
    const hasValidPrefix = VALID_PROXY_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
    if (!hasValidPrefix) {
      return {
        proxyUrl: null,
        error: "proxyUrl must start with http://, https://, socks4://, or socks5://",
      };
    }
    return { proxyUrl: trimmed, error: null };
  }

  // Fallback: check settings for outbound proxy automation opt-in
  try {
    const settings = await getSettings();
    if (settings.useOutboundProxyForAutomation === true && settings.outboundProxyUrl) {
      return { proxyUrl: settings.outboundProxyUrl, error: null };
    }
  } catch {
    // Settings unavailable; proceed without proxy
  }

  return { proxyUrl: null, error: null };
}
