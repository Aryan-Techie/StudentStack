import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const saveBookmark = vi.fn();
const removeBookmark = vi.fn();
vi.mock("@/app/my-list/actions", () => ({
  saveBookmark: (...args: unknown[]) => saveBookmark(...args),
  removeBookmark: (...args: unknown[]) => removeBookmark(...args),
}));

import { BookmarksProvider } from "./bookmarks-provider";
import { BookmarkButton } from "./bookmark-button";

function mockBookmarksApi(body: { signedIn: boolean; bookmarks: Record<number, string> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
  );
}

function renderButton() {
  return render(
    <BookmarksProvider>
      <BookmarkButton resourceId={7} resourceName="Figma" />
    </BookmarksProvider>,
  );
}

beforeEach(() => {
  saveBookmark.mockReset();
  removeBookmark.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BookmarkButton", () => {
  it("sends signed-out students to sign in, carrying the resource", async () => {
    mockBookmarksApi({ signedIn: false, bookmarks: {} });
    renderButton();
    const link = await screen.findByRole("link", { name: "Sign in to save Figma" });
    expect(link.getAttribute("href")).toBe("/my-list?save=7");
  });

  it("saves as Interested in one click when signed in", async () => {
    mockBookmarksApi({ signedIn: true, bookmarks: {} });
    saveBookmark.mockResolvedValue({ ok: true });
    renderButton();
    const button = await screen.findByRole("button", { name: "Save Figma" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    expect(saveBookmark).toHaveBeenCalledWith(7, "interested");
    expect(await screen.findByRole("button", { name: /saved as Interested/ })).toBeTruthy();
  });

  it("rolls back when the save fails", async () => {
    mockBookmarksApi({ signedIn: true, bookmarks: {} });
    saveBookmark.mockResolvedValue({ ok: false, reason: "failed" });
    renderButton();
    const button = await screen.findByRole("button", { name: "Save Figma" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Save Figma" })).toBeTruthy();
  });

  it("shows the saved status from the API", async () => {
    mockBookmarksApi({ signedIn: true, bookmarks: { 7: "applied" } });
    renderButton();
    expect(await screen.findByRole("button", { name: /saved as Applied/ })).toBeTruthy();
  });
});
