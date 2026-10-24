/** 驗證 LINE webhook 的 x-line-signature（HMAC-SHA256 + base64） */
export async function verifySignature(body: string, signature: string | undefined, channelSecret: string) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(channelSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
