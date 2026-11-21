import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DemoLink, StandbyOnArrival } from "./DemoLink";

// The dialog focuses "Got it" 30 ms after opening; wait for it.
const settle = () => new Promise((r) => setTimeout(r, 60));

// No Vitest globals here, so Testing Library can't clean up by itself.
afterEach(cleanup);

describe("DemoLink", () => {
  it("gives each dialog its own ids when several are on the page", () => {
    render(
      <>
        <DemoLink standby>Try the demo</DemoLink>
        <DemoLink standby>Try the demo too</DemoLink>
      </>,
    );
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is a normal link to the demo when standby is off", () => {
    render(<DemoLink standby={false}>Try the demo</DemoLink>);
    const link = screen.getByRole("link", { name: "Try the demo" });
    expect(link).toHaveAttribute("href", "/demo");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps a custom href (e.g. Resume → /ask)", () => {
    render(
      <DemoLink standby={false} href="/ask">
        Resume your demo
      </DemoLink>,
    );
    expect(screen.getByRole("link", { name: "Resume your demo" })).toHaveAttribute("href", "/ask");
  });

  it("opens the stand-by dialog instead of going to the demo when standby is on", async () => {
    const user = userEvent.setup();
    render(<DemoLink standby>Try the demo</DemoLink>);
    // A button, not a link: it no longer navigates anywhere.
    expect(screen.queryByRole("link", { name: "Try the demo" })).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Try the demo" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    // Closed: hidden from assistive tech.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "RAG in development, please stand by" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/coming soon/i);
    await settle();
    expect(screen.getByRole("button", { name: "Got it" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("offers the pipeline section and the code instead", async () => {
    const user = userEvent.setup();
    render(<DemoLink standby>Try the demo</DemoLink>);
    await user.click(screen.getByRole("button", { name: "Try the demo" }));
    expect(screen.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "/#pipeline");
    expect(screen.getByRole("link", { name: "View the code" })).toHaveAttribute("href", "https://github.com/AmaanAli1/recall");
  });

  it("closes with Got it, Escape or See how it works, and gives focus back", async () => {
    const user = userEvent.setup();
    render(<DemoLink standby>Try the demo</DemoLink>);
    const trigger = screen.getByRole("button", { name: "Try the demo" });

    await user.click(trigger);
    await settle();
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");

    await user.click(trigger);
    await settle();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await settle();
    await user.click(screen.getByRole("link", { name: "See how it works" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps Tab inside the open dialog", async () => {
    const user = userEvent.setup();
    render(<DemoLink standby>Try the demo</DemoLink>);
    await user.click(screen.getByRole("button", { name: "Try the demo" }));
    await settle();
    // Got it (last) → Tab wraps to the first item, View the code.
    await user.tab();
    expect(screen.getByRole("link", { name: "View the code" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Got it" })).toHaveFocus();
  });
});

describe("StandbyOnArrival", () => {
  it("opens the dialog when the visitor was redirected from a demo page, and tidies the URL", async () => {
    window.history.replaceState(null, "", "/?standby=1#pipeline");
    render(<StandbyOnArrival standby />);
    expect(await screen.findByRole("dialog", { name: "RAG in development, please stand by" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#pipeline");

    await userEvent.setup().click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays closed on a normal visit", async () => {
    window.history.replaceState(null, "", "/");
    render(<StandbyOnArrival standby />);
    await settle();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when standby is off, even with ?standby=1", async () => {
    window.history.replaceState(null, "", "/?standby=1");
    const { container } = render(<StandbyOnArrival standby={false} />);
    await settle();
    expect(container).toBeEmptyDOMElement();
    expect(window.location.search).toBe("?standby=1");
  });
});
