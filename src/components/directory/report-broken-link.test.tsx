import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportBrokenLink } from "./report-broken-link";
import { MOCK_RESOURCES } from "@/lib/mock-data";

const resource = MOCK_RESOURCES[0];
const fetchMock = vi.fn();

function openForm(textButton = false) {
  render(<ReportBrokenLink resource={resource} textButton={textButton} />);
  fireEvent.click(screen.getByRole("button", { name: `Report a problem with ${resource.name}` }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("ReportBrokenLink", () => {
  it("toggles the report form from the icon button", () => {
    render(<ReportBrokenLink resource={resource} />);
    const toggle = screen.getByRole("button", { name: `Report a problem with ${resource.name}` });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("form")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("form", { name: `Report a problem with ${resource.name}` })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("offers a text button variant", () => {
    openForm(true);
    expect(screen.getByText("Report issue")).not.toBeNull();
    expect((screen.getByRole("radio", { name: "Dead link" }) as HTMLInputElement).checked).toBe(true);
  });

  it("posts the chosen kind and note, then thanks the reporter", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    openForm();
    fireEvent.click(screen.getByRole("radio", { name: "Wrong info" }));
    fireEvent.change(screen.getByPlaceholderText(/optional note/i), { target: { value: "Price changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    expect((await screen.findByRole("status")).textContent).toMatch(/reported for review/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/reports");
    expect(JSON.parse(init.body as string)).toEqual({ resourceId: resource.id, kind: "wrong-info", note: "Price changed" });
  });

  it("shows an error and lets the reporter retry", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn.t submit/i);

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a second submit while the first is in flight", async () => {
    let resolve: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    openForm();
    const submit = screen.getByRole("button", { name: "Submit report" });
    fireEvent.click(submit);
    expect(((await screen.findByRole("button", { name: "Sending…" })) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("form"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response("{}", { status: 200 }));
    expect(await screen.findByRole("status")).not.toBeNull();
  });

  it("keeps clicks and Enter/Space from reaching the card underneath", () => {
    const onCardClick = vi.fn();
    const onCardKey = vi.fn();
    render(
      <div onClick={onCardClick} onKeyDown={onCardKey}>
        <ReportBrokenLink resource={resource} />
      </div>,
    );
    const toggle = screen.getByRole("button", { name: `Report a problem with ${resource.name}` });
    fireEvent.click(toggle);
    fireEvent.keyDown(toggle, { key: "Enter" });
    fireEvent.keyDown(toggle, { key: " " });
    expect(onCardClick).not.toHaveBeenCalled();
    expect(onCardKey).not.toHaveBeenCalled();
    fireEvent.keyDown(toggle, { key: "a" });
    expect(onCardKey).toHaveBeenCalledTimes(1);
  });
});
