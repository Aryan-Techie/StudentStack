// Server-side SSRF guards for fetching user-controlled URLs.
// Import only from server code (server actions, API routes, cron handlers) —
// this module pulls in node:dns.

import { promises as dns, type LookupAddress } from "node:dns";
import { isBlockedIp, METADATA_HOSTNAMES } from "./ip-ranges";

export { isBlockedIp };

function stripBrackets(host: string): string {
  return host.replace(/^\[|\]$/g, "");
}

// DNS seam: tests override `resolveHost` (e.g. via vi.spyOn) instead of
// module-mocking the node:dns builtin.
export const dnsResolver = {
  resolveHost(hostname: string): Promise<LookupAddress[]> {
    return dns.lookup(hostname, { all: true });
  },
};

/**
 * True when `hostname` resolves exclusively to public IP addresses.
 * Fails closed: DNS errors, empty answers, metadata hostnames, or any
 * resolved address in a blocked range all return false.
 */
export async function hostnameIsPublic(hostname: string): Promise<boolean> {
  const host = stripBrackets(hostname).toLowerCase();
  if (METADATA_HOSTNAMES.has(host)) return false;
  let addresses: LookupAddress[];
  try {
    // For IP literals, lookup returns the literal itself — still screened
    // by isBlockedIp below, so 127.0.0.1 / ::1 / 169.254.169.254 never pass.
    addresses = await dnsResolver.resolveHost(host);
  } catch {
    return false;
  }
  if (addresses.length === 0) return false;
  return addresses.every((a) => !isBlockedIp(a.address));
}

/**
 * Validate a user-controlled URL for server-side fetching. Throws when the
 * URL is not http(s) or its hostname does not resolve to a public IP.
 * Returns the normalized URL string on success.
 */
export async function assertPublicUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("SSRF guard: not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SSRF guard: only http(s) URLs may be fetched server-side");
  }
  if (!(await hostnameIsPublic(url.hostname))) {
    throw new Error(`SSRF guard: ${url.hostname} does not resolve to a public address`);
  }
  return url.toString();
}

export function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
