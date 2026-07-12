import { NextRequest, NextResponse } from "next/server";

const AI_SERVER = process.env.AI_SERVER_URL || "http://localhost:8001";
const AI_KEY    = process.env.AI_API_KEY    || "";

// Next.js 15+: params는 Promise
async function proxy(req: NextRequest, pathSegments: string[]) {
  const query = req.nextUrl.search;
  const url = `${AI_SERVER}/${pathSegments.join("/")}${query}`;

  const contentType = req.headers.get("content-type") ?? "";
  const headers: Record<string, string> = {};
  if (AI_KEY) headers["X-Api-Key"] = AI_KEY;
  if (contentType) headers["Content-Type"] = contentType;

  const body = await req.arrayBuffer();

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body: body.byteLength > 0 ? body : undefined,
    });

    const ct = res.headers.get("content-type") ?? "";
    if (ct.startsWith("image/") || ct.startsWith("video/") || ct.includes("octet-stream")) {
      const outHeaders = new Headers();
      outHeaders.set("content-type", ct);
      return new Response(res.body, { status: res.status, headers: outHeaders });
    }

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[AI Proxy] 오류:", url, e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const query = req.nextUrl.search;
  const url   = `${AI_SERVER}/${path.join("/")}${query}`;

  const headers: Record<string, string> = {};
  if (AI_KEY) headers["X-Api-Key"] = AI_KEY;

  try {
    const res  = await fetch(url, { headers });

    // 이미지/바이너리 응답은 그대로 스트리밍 (감지 이미지 <img src> 용)
    const ct = res.headers.get("content-type") ?? "";
    if (
      ct.startsWith("image/") ||
      ct.startsWith("video/") ||
      ct.includes("octet-stream") ||
      ct.includes("multipart/")
    ) {
      const outHeaders = new Headers();
      outHeaders.set("content-type", ct);
      const cacheControl = res.headers.get("cache-control");
      if (cacheControl) outHeaders.set("cache-control", cacheControl);
      return new Response(res.body, { status: res.status, headers: outHeaders });
    }

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
