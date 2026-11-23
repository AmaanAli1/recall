import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DemoSession } from "@/lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const api = vi.hoisted(() => ({ getDemoSession: vi.fn(), endDemoSession: vi.fn() }));
vi.mock("@/lib/api", () => api);

const { DemoChip } = await import("./DemoChip");

afterEach(cleanup);

const SESSION: DemoSession = { id: "demo-AB12-CD", createdAt: "2026-11-22T00:00:00Z", lastActiveAt: "2026-11-22T00:00:00Z" } as DemoSession;

describe("DemoChip", () => {
  it("offers Start the demo when there's no session (instead of claiming one is kept)", async () => {
    api.getDemoSession.mockResolvedValue(null);
    render(<DemoChip />);
    expect(await screen.findByRole("link", { name: "Start the demo" })).toHaveAttribute("href", "/demo");
    expect(screen.queryByRole("button", { name: /Demo · kept 24/ })).not.toBeInTheDocument();
  });

  it("shows the session chip when there is one", async () => {
    api.getDemoSession.mockResolvedValue(SESSION);
    render(<DemoChip />);
    expect(await screen.findByRole("button", { name: /Demo · kept 24/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start the demo" })).not.toBeInTheDocument();
    expect(screen.getByText("demo-AB12-CD")).toBeInTheDocument();
  });

  it("treats a failed check as no session", async () => {
    api.getDemoSession.mockRejectedValue(new Error("offline"));
    render(<DemoChip />);
    expect(await screen.findByRole("link", { name: "Start the demo" })).toBeInTheDocument();
  });

  it("shows nothing clickable while it's still checking", () => {
    api.getDemoSession.mockReturnValue(new Promise(() => {})); // never settles
    render(<DemoChip />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
