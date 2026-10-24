// LINE Messaging API 的最小封裝：只用到回覆和推播
export type LineMessage = Record<string, unknown>;

export interface LineClient {
  reply(replyToken: string, messages: LineMessage[]): Promise<void>;
  push(to: string, messages: LineMessage[]): Promise<void>;
}

const API = "https://api.line.me/v2/bot/message";

export function createLineClient(accessToken: string, fetchFn: typeof fetch = fetch): LineClient {
  async function post(path: string, body: unknown) {
    const res = await fetchFn(`${API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LINE API ${path} 失敗：${res.status} ${await res.text()}`);
  }
  return {
    reply: (replyToken, messages) => post("reply", { replyToken, messages }),
    push: (to, messages) => post("push", { to, messages }),
  };
}
