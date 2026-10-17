// Pure IP-literal classification for SSRF guards — no Node imports, so this
// module is safe to use from client-safe code too (e.g. normalizeUrl in
// src/lib/submissions.ts). DNS resolution lives in src/lib/ssrf.ts.

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^[0-9]{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function ipv6ToBigInt(ip: string): bigint | null {
  // Handle embedded dotted IPv4: ::ffff:192.0.2.1
  let addr = ip;
  const embedded = ip.match(/:([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})$/);
  if (embedded) {
    const v4 = ipv4ToInt(embedded[1]);
    if (v4 === null) return null;
    addr =
      ip.slice(0, ip.length - embedded[1].length) +
      ((v4 >>> 16) & 0xffff).toString(16) +
      ":" +
      (v4 & 0xffff).toString(16);
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && head.length !== 8) return null;
  if (head.length + tail.length > 8) return null;
  const groups: bigint[] = [];
  for (const part of [...head, ...tail]) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null;
    groups.push(BigInt(parseInt(part, 16)));
  }
  const zero = BigInt(0);
  const full = [
    ...groups.slice(0, head.length),
    ...new Array<bigint>(8 - head.length - tail.length).fill(zero),
    ...groups.slice(head.length),
  ];
  let value = zero;
  const sixteen = BigInt(16);
  for (const g of full) value = (value << sixteen) | g;
  return value;
}

// [first, last] as unsigned 32-bit ints.
const IPV4_BLOCKED: Array<[number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8 — "this network"
  [0x0a000000, 0x0affffff], // 10.0.0.0/8 — private
  [0x64400000, 0x647fffff], // 100.64.0.0/10 — carrier-grade NAT
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 — loopback
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 — link-local (cloud metadata lives here)
  [0xac100000, 0xac1fffff], // 172.16.0.0/12 — private
  [0xc0000000, 0xc00000ff], // 192.0.0.0/24 — IETF protocol assignments
  [0xc0000200, 0xc00002ff], // 192.0.2.0/24 — TEST-NET-1 (documentation)
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16 — private
  [0xc6120000, 0xc613ffff], // 198.18.0.0/15 — benchmarking
  [0xc6336400, 0xc63364ff], // 198.51.100.0/24 — TEST-NET-2 (documentation)
  [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 — TEST-NET-3 (documentation)
  [0xe0000000, 0xefffffff], // 224.0.0.0/4 — multicast
  [0xf0000000, 0xffffffff], // 240.0.0.0/4 — reserved
];

// [base address, prefix length].
const IPV6_BLOCKED: Array<[string, number]> = [
  ["::1", 128], // loopback
  ["::", 128], // unspecified
  ["64:ff9b::", 96], // NAT64 well-known prefix (embeds arbitrary IPv4)
  ["64:ff9b:1::", 48], // NAT64 local-use prefix
  ["100::", 64], // discard
  ["2001::", 23], // IETF protocol assignments (Teredo, etc.)
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
];

function ipv6InSubnet(addr: bigint, base: string, prefix: number): boolean {
  const baseInt = ipv6ToBigInt(base);
  if (baseInt === null) return false;
  const shift = BigInt(128 - prefix);
  return (addr >> shift) === (baseInt >> shift);
}

/**
 * True when `ip` is an IP literal inside a non-public range
 * (private, loopback, link-local, multicast, reserved, documentation,
 * CGNAT, or IPv4-mapped-IPv6 wrapping a blocked IPv4).
 * Returns false for anything that isn't an IP literal — callers are
 * expected to resolve hostnames via DNS (see src/lib/ssrf.ts).
 */
export function isBlockedIp(ip: string): boolean {
  const host = ip.replace(/^\[|\]$/g, "");
  const v4 = ipv4ToInt(host);
  if (v4 !== null) {
    return IPV4_BLOCKED.some(([lo, hi]) => v4 >= lo && v4 <= hi);
  }
  const v6 = ipv6ToBigInt(host);
  if (v6 === null) return false;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — judge by the embedded IPv4 address.
  if ((v6 >> BigInt(32)) === BigInt(0xffff)) {
    const embedded = Number(v6 & BigInt(0xffffffff));
    return IPV4_BLOCKED.some(([lo, hi]) => embedded >= lo && embedded <= hi);
  }
  return IPV6_BLOCKED.some(([base, prefix]) => ipv6InSubnet(v6, base, prefix));
}

/** Well-known cloud metadata hostnames — blocked even before DNS. */
export const METADATA_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
  "instance-data.compute.internal",
]);
