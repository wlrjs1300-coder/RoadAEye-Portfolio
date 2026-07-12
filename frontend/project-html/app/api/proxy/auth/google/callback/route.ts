import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const backendRes = await fetch(
    `${API_URL}/auth/google/callback?code=${code}&state=${state}`,
    {
      method: "GET",
      redirect: "manual",
    }
  );

  // 백엔드가 307 리다이렉트로 토큰을 전달하는 경우
  const location = backendRes.headers.get("location");
  if (location) {
    const url = new URL(location);
    const token = url.searchParams.get("token");
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.json({ error }, { status: 403 });
    }

    if (token) {
      // 토큰을 JSON으로 반환
      return NextResponse.json({ access_token: token });
    }
  }

  return NextResponse.json({ error: "토큰 발급 실패" }, { status: 502 });
}