import { describe, it, expect } from 'vitest';
import { getAllResourceSlugs, getResourceBySlug } from '@/lib/resources';

// POSTGRES_URL is unset in the test env, so these exercise the mock-data
// fallback path (same contract as the DB path: approved resources only).
describe('resource SEO data access', () => {
  describe('getResourceBySlug', () => {
    it('returns the resource for a known slug', async () => {
      const resource = await getResourceBySlug('github-copilot');
      expect(resource?.name).toBe('GitHub Copilot');
      expect(resource?.slug).toBe('github-copilot');
    });

    it('returns null for an unknown slug (page renders 404)', async () => {
      await expect(getResourceBySlug('no-such-offer')).resolves.toBeNull();
    });
  });

  describe('getAllResourceSlugs', () => {
    it('returns every slug with an updatedAt date for the sitemap', async () => {
      const slugs = await getAllResourceSlugs();
      expect(slugs.length).toBeGreaterThan(0);
      for (const entry of slugs) {
        expect(typeof entry.slug).toBe('string');
        expect(entry.updatedAt).toBeInstanceOf(Date);
      }
      expect(slugs.map((s) => s.slug)).toContain('github-copilot');
    });
  });
});
