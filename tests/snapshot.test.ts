import { describe, expect, it } from "vitest";
import { compareSnapshot, normalizeText, selectFollowLinks } from "../scripts/lib/snapshot";

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

describe("selectFollowLinks", () => {
  const base = "https://card.firstbank.com.tw/sites/Satellite?cid=1";

  it("只保留同一家銀行網域，去除重複與錨點，並依網址排序", () => {
    const links = selectFollowLinks(
      [
        { href: "/sites/Satellite?cid=3", text: " 活動 B " },
        { href: "https://www.firstbank.com.tw/act.pdf", text: "辦法" },
        { href: "https://card.firstbank.com.tw/sites/Satellite?cid=2#top", text: "活動 A" },
        { href: "https://card.firstbank.com.tw/sites/Satellite?cid=2", text: "重複" },
        { href: "https://www.facebook.com/firstbank", text: "粉專" },
        { href: "javascript:void(0)", text: "x" },
        { href: base, text: "自己" },
      ],
      base,
    );
    expect(links).toEqual([
      { href: "https://card.firstbank.com.tw/sites/Satellite?cid=2", text: "活動 A" },
      { href: "https://card.firstbank.com.tw/sites/Satellite?cid=3", text: "活動 B" },
      { href: "https://www.firstbank.com.tw/act.pdf", text: "辦法" },
    ]);
  });

  it("限制數量", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ href: `/p${String(i).padStart(2, "0")}`, text: "" }));
    expect(selectFollowLinks(many, base, 5)).toHaveLength(5);
  });
});
