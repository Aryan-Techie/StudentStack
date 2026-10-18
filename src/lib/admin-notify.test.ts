import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getWebhookUrl,
  buildBrokenLinksMessage,
  notifyBrokenLinks,
  type BrokenLink,
  type LinkHealthSummary,
} from '@/lib/admin-notify';

const summary: LinkHealthSummary = {
  checked: 10,
  active: 8,
  broken: 1,
  expired: 1,
  checkedAt: '2026-10-18T00:00:00.000Z',
};

const links: BrokenLink[] = [
  { id: 1, url: 'https://example.com/a', previousStatus: 'active', newStatus: 'broken' },
  { id: 2, url: 'https://example.com/b', previousStatus: 'broken', newStatus: 'expired' },
];

afterEach(() => {
  delete process.env.LINK_HEALTH_WEBHOOK_URL;
});

describe('admin-notify.ts', () => {
  describe('getWebhookUrl', () => {
    it('returns the configured webhook URL', () => {
      process.env.LINK_HEALTH_WEBHOOK_URL = 'https://hooks.example/x';
      expect(getWebhookUrl()).toBe('https://hooks.example/x');
    });

    it('returns null when unconfigured or blank', () => {
      expect(getWebhookUrl()).toBeNull();
      process.env.LINK_HEALTH_WEBHOOK_URL = '   ';
      expect(getWebhookUrl()).toBeNull();
    });
  });

  describe('buildBrokenLinksMessage', () => {
    it('lists the flagged links with their transitions and the run summary', () => {
      const message = buildBrokenLinksMessage(links, summary);
      expect(message).toContain('2 newly flagged links');
      expect(message).toContain('https://example.com/a (active -> broken)');
      expect(message).toContain('https://example.com/b (broken -> expired)');
      expect(message).toContain('Checked 10 URLs');
    });

    it('truncates long lists at 20 entries', () => {
      const many: BrokenLink[] = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        url: `https://example.com/${i}`,
        previousStatus: 'active',
        newStatus: 'broken' as const,
      }));
      const message = buildBrokenLinksMessage(many, summary);
      expect(message).toContain('…and 5 more');
      expect(message).not.toContain('https://example.com/24');
    });
  });

  describe('notifyBrokenLinks', () => {
    it('does nothing when there are no newly flagged links', async () => {
      const fetchImpl = vi.fn();
      const result = await notifyBrokenLinks([], summary, {
        webhookUrl: 'https://hooks.example/x',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result).toEqual({ sent: false, reason: 'no newly flagged links' });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('skips silently when no webhook is configured', async () => {
      const fetchImpl = vi.fn();
      const result = await notifyBrokenLinks(links, summary, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result.sent).toBe(false);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('POSTs the message as JSON to the webhook', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      const result = await notifyBrokenLinks(links, summary, {
        webhookUrl: 'https://hooks.example/x',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result).toEqual({ sent: true });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe('https://hooks.example/x');
      expect(init.method).toBe('POST');
      expect(init.headers['content-type']).toBe('application/json');
      const body = JSON.parse(init.body as string);
      expect(body.text).toContain('https://example.com/a');
    });

    it('reports HTTP errors instead of throwing', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      const result = await notifyBrokenLinks(links, summary, {
        webhookUrl: 'https://hooks.example/x',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result).toEqual({ sent: false, reason: 'webhook returned HTTP 500' });
    });

    it('reports network failures instead of throwing', async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed'));
      const result = await notifyBrokenLinks(links, summary, {
        webhookUrl: 'https://hooks.example/x',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result.sent).toBe(false);
      expect((result as { reason: string }).reason).toContain('fetch failed');
    });
  });
});
