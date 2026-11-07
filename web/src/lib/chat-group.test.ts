import { describe, expect, it } from "vitest";
import { chatGroup } from "./chat-group";

// Built with local-time constructors, so these pass in any timezone.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("chatGroup", () => {
  const now = at(2026, 11, 5, 21, 0); // Nov 5, 9 pm local

  it("puts anything from today's calendar day in Today", () => {
    expect(chatGroup(at(2026, 11, 5, 0, 1).toISOString(), now)).toBe("Today");
    expect(chatGroup(at(2026, 11, 5, 20, 59).toISOString(), now)).toBe("Today");
  });

  it("uses calendar days: 11:59 pm yesterday is This week, even if only hours ago", () => {
    expect(chatGroup(at(2026, 11, 4, 23, 59).toISOString(), now)).toBe("This week");
  });

  it("6 days ago is This week; 7 days ago is Earlier", () => {
    expect(chatGroup(at(2026, 10, 30).toISOString(), now)).toBe("This week");
    expect(chatGroup(at(2026, 10, 29).toISOString(), now)).toBe("Earlier");
  });

  it("counts days correctly across a daylight-saving change (Nov 1 in Toronto)", () => {
    const afterDst = at(2026, 11, 3, 9, 0);
    expect(chatGroup(at(2026, 10, 28, 9, 0).toISOString(), afterDst)).toBe("This week");
    expect(chatGroup(at(2026, 10, 27, 9, 0).toISOString(), afterDst)).toBe("Earlier");
  });

  it("treats a time slightly in the future (clock skew) as Today, and garbage as Earlier", () => {
    expect(chatGroup(at(2026, 11, 5, 21, 5).toISOString(), now)).toBe("Today");
    expect(chatGroup("not a date", now)).toBe("Earlier");
  });
});
