import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@motoriders.app";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function buildVapidJwt(audience: string): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const payload = { aud: new URL(audience).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT };
  const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const rawKey = Uint8Array.from(atob(VAPID_PRIVATE_KEY.replace(/-/g,"+").replace(/_/g,"/")), (c: string) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", rawKey.buffer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cryptoKey, new TextEncoder().encode(unsigned));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  return `${unsigned}.${sigB64}`;
}

async function sendOne(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: object): Promise<number> {
  const jwt = await buildVapidJwt(sub.endpoint);
  const { encrypt } = await import("https://esm.sh/web-push-encryption@1.0.0");
  const encrypted = await encrypt(sub.keys.p256dh, sub.keys.auth, JSON.stringify(payload), 4096);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "TTL": "86400",
    },
    body: encrypted,
  });
  return res.status;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }
  try {
    const { user_id, title, message, url, tag } = await req.json();
    if (!user_id || !title) return new Response(JSON.stringify({ error: "user_id و title مطلوبان" }), { status: 400 });
    const { data: subs, error } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", user_id);
    if (error || !subs?.length) return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), { status: 200 });
    const payload = { title, body: message || "", url: url || "/", tag: tag || "motoriders" };
    const results = await Promise.allSettled(subs.map((s: { endpoint: string; p256dh: string; auth: string }) => sendOne({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)));
    const expired = subs.filter((_: unknown, i: number) => { const r = results[i]; return r.status === "fulfilled" && (r as PromiseFulfilledResult<number>).value === 410; });
    if (expired.length) await supabase.from("push_subscriptions").delete().in("endpoint", expired.map((s: { endpoint: string }) => s.endpoint));
    const sent = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<number>).value < 300).length;
    return new Response(JSON.stringify({ sent, total: subs.length }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
