export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  function sseError(message: string) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message })}\n\n`,
      { status: 200, headers: sseHeaders }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const authorization = request.headers.get("authorization");

    if (!authorization) {
      return sseError("로그인 후 챗봇을 이용해 주세요.");
    }

    const upstreamUrl = `${backendUrl.replace(/\/$/, "")}/chat/stream?${searchParams.toString()}`;

    const res = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        Authorization: authorization,
      },
    });

    if (!res.ok) {
      const message = res.status === 401 || res.status === 403
        ? "로그인 정보가 만료되었습니다. 다시 로그인해 주세요."
        : "AI 서버 연결 실패";
      return sseError(message);
    }

    const body = await res.text();
    return new Response(body, { status: 200, headers: sseHeaders });
  } catch {
    return sseError("일시적인 오류가 발생했습니다.");
  }
}
