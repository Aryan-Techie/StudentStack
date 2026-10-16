import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isBlockedIp, METADATA_HOSTNAMES } from '@/lib/ip-ranges';
import { hostnameIsPublic, assertPublicUrl, dnsResolver } from '@/lib/ssrf';
import { normalizeUrl } from '@/lib/submissions';

describe('ip-ranges', () => {
  describe('isBlockedIp', () => {
    it.each([
      '10.0.0.1',
      '172.16.5.4',
      '192.168.1.1',
      '127.0.0.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '240.0.0.1',
      '192.0.2.1',
      '198.51.100.7',
      '203.0.113.9',
      '198.18.0.1',
    ])('blocks non-public IPv4 %s', (ip) => {
      expect(isBlockedIp(ip)).toBe(true);
    });

    it.each(['8.8.8.8', '93.184.216.34', '1.1.1.1'])('allows public IPv4 %s', (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    });

    it.each([
      '::1',
      '::',
      'fe80::1',
      'fc00::1',
      'fd12:3456::1',
      'ff02::1',
      '2001:db8::1',
      '::ffff:169.254.169.254',
      '::ffff:127.0.0.1',
      '::ffff:10.1.2.3',
    ])('blocks non-public IPv6 %s', (ip) => {
      expect(isBlockedIp(ip)).toBe(true);
    });

    it.each(['::ffff:8.8.8.8', '2606:4700:4700::1111'])('allows public IPv6 %s', (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    });

    it('returns false for non-literals (DNS resolution is the caller\'s job)', () => {
      expect(isBlockedIp('example.com')).toBe(false);
      expect(isBlockedIp('not-an-ip')).toBe(false);
    });
  });

  it('metadata hostnames blocklist is non-empty', () => {
    expect(METADATA_HOSTNAMES.has('metadata.google.internal')).toBe(true);
  });
});

describe('ssrf', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockResolve(addresses: Array<{ address: string; family: number }>) {
    vi.spyOn(dnsResolver, 'resolveHost').mockResolvedValue(addresses);
  }

  describe('hostnameIsPublic', () => {
    it('returns true when all resolved addresses are public', async () => {
      mockResolve([
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ]);
      await expect(hostnameIsPublic('example.com')).resolves.toBe(true);
    });

    it('returns false when any resolved address is private', async () => {
      mockResolve([
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.5', family: 4 },
      ]);
      await expect(hostnameIsPublic('evil.example.com')).resolves.toBe(false);
    });

    it('returns false for an IP literal in a blocked range', async () => {
      mockResolve([{ address: '169.254.169.254', family: 4 }]);
      await expect(hostnameIsPublic('169.254.169.254')).resolves.toBe(false);
    });

    it('returns false for a cloud metadata hostname without DNS', async () => {
      const spy = vi.spyOn(dnsResolver, 'resolveHost').mockRejectedValue(new Error('should not be called'));
      await expect(hostnameIsPublic('metadata.google.internal')).resolves.toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it('fails closed on DNS errors', async () => {
      vi.spyOn(dnsResolver, 'resolveHost').mockRejectedValue(new Error('ENOTFOUND'));
      await expect(hostnameIsPublic('missing.invalid')).resolves.toBe(false);
    });
  });

  describe('assertPublicUrl', () => {
    it('returns the normalized URL for a public host', async () => {
      mockResolve([{ address: '93.184.216.34', family: 4 }]);
      await expect(assertPublicUrl('https://example.com/offer')).resolves.toBe('https://example.com/offer');
    });

    it('rejects non-http(s) protocols', async () => {
      await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow();
      await expect(assertPublicUrl('ftp://example.com/x')).rejects.toThrow();
    });

    it('rejects hosts resolving to private IPs', async () => {
      mockResolve([{ address: '192.168.1.10', family: 4 }]);
      await expect(assertPublicUrl('https://intranet.example.com/')).rejects.toThrow(/public address/);
    });
  });
});

describe('normalizeUrl SSRF hardening', () => {
  it('rejects cloud metadata IP literals', () => {
    expect(normalizeUrl('http://169.254.169.254/latest/meta-data/')).toBeNull();
    expect(normalizeUrl('http://127.0.0.1:3000/admin')).toBeNull();
    expect(normalizeUrl('http://10.0.0.5/secret')).toBeNull();
    expect(normalizeUrl('http://[::1]/')).toBeNull();
  });

  it('rejects known metadata hostnames', () => {
    expect(normalizeUrl('http://metadata.google.internal/computeMetadata/v1/')).toBeNull();
  });

  it('still accepts ordinary public URLs', () => {
    expect(normalizeUrl('https://example.com/student-discount')).toBe('https://example.com/student-discount');
  });
});
