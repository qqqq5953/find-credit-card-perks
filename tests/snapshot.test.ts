import { describe, expect, it } from "vitest";
import { compareSnapshot, normalizeText } from "../scripts/lib/snapshot";

describe("normalizeText", () => {
  it("去掉多餘空白與空行", () => {
    expect(normalizeText("  國內  1% \r\n\n\n\t海外　3%  ", {})).toBe("國內 1%\n海外 3%\n");
  });

  it("移除 ignore_patterns 指定的雜訊", () => {
    const src = { ignore_patterns: ["瀏覽人次：\\d+", "更新時間：[\\d/: ]+"] };
    expect(normalizeText("回饋 3%\n瀏覽人次：12345\n更新時間：2026/10/24 10:00", src)).toBe("回饋 3%\n");
  });
});

describe("compareSnapshot", () => {
  it("判斷狀態", () => {
    expect(compareSnapshot(null, "a")).toBe("baseline");
    expect(compareSnapshot("a", "a")).toBe("unchanged");
    expect(compareSnapshot("a", "b")).toBe("changed");
  });
});
