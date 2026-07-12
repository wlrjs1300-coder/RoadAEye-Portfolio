import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 브라우저 → (같은 origin) Next 프록시 → 백엔드(:8000) 로 전달하는 공용 핸들러.
// 사설 IP(localhost)는 서버 측에서만 접근하므로 외부망 브라우저에서도 동작한다.
async function forward(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: string
) {
  const { path } = await context.params;
  const query = req.nextUrl.search;
  const url = `${BACKEND}/${path.join("/")}${query}`;

  // 인증/쿠키/컨텐츠 타입 헤더를 백엔드로 전달 (JWT Bearer 토큰 포함)
  const headers: Record<string, string> = {
    cookie: req.headers.get("cookie") ?? "",
  };
  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  const hasBody = method !== "GET" && method !== "DELETE";
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    body = await req.arrayBuffer();
    headers["Content-Type"] =
      req.headers.get("content-type") ?? "application/json";
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (
      contentType.includes("multipart/") ||
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.includes("octet-stream")
    ) {
      const outHeaders = new Headers();
      outHeaders.set("content-type", contentType);
      const cacheControl = res.headers.get("cache-control");
      if (cacheControl) outHeaders.set("cache-control", cacheControl);
      return new Response(res.body, { status: res.status, headers: outHeaders });
    }

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    const out = NextResponse.json(data, { status: res.status });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) out.headers.set("set-cookie", setCookie);
    return out;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context, "GET");
}
export function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context, "POST");
}
export function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context, "PUT");
}
export function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context, "PATCH");
}
export function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(req, context, "DELETE");
}
