"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AI 서버의 ITS 분석 결과를 WebSocket으로 수신하는 hook.
 *
 * 백엔드(.247)의 WebSocket 프록시(`/its/ws/{camera_id}`) 경유.
 * AI 서버(.246:8001)는 외부 직접 접근이 차단되어 백엔드가 단방향 forwarding.
 * (메시지는 AI 서버 메모리에서 직접 송출되므로 DB·VIP 라우팅과 무관)
 *
 * AI 서버 송출 메시지 형식 (services/its/service.py 기준):
 *   {
 *     camera_id: string,
 *     camera_name: string,
 *     timestamp: "YYYY-MM-DD HH:MM:SS",
 *     total_detections: number,
 *     forbidden_detections: [ { class_name, class_no, confidence, box } ]
 *   }
 *
 * 사용 예:
 *   const { state, lastFrame } = useDetectionStream({
 *     cameraId: "demo-ws-1",
 *     onForbidden: (frame) => { ... 진입금지 객체가 감지된 프레임만 ... },
 *   });
 */

export interface DetectionItem {
  class_name: string;
  class_no?: number;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
}

export interface FrameResult {
  camera_id: string;
  camera_name: string;
  timestamp: string;
  total_detections: number;
  forbidden_detections: DetectionItem[];
}

export type ConnState = "connecting" | "open" | "closed" | "error";

interface UseDetectionStreamOptions {
  cameraId: string;
  // 연결을 일시적으로 꺼두고 싶을 때 false. 기본 true.
  enabled?: boolean;
  // forbidden_detections.length > 0 인 프레임에서만 호출 (실제 진입금지 감지)
  onForbidden?: (frame: FrameResult) => void;
}

// 백엔드 WebSocket base URL — 백엔드(.247)의 ITS WS 프록시 경로
// NEXT_PUBLIC_API_URL이 http로 정의되어 있다면 ws로 자동 변환
function deriveWsBase(): string {
  const explicit = typeof process !== "undefined" && process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit;
  const api = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  // http → ws, https → wss 로 치환
  return api.replace(/^http(s?):/i, (_m, s) => `ws${s}:`);
}
const WS_BASE = deriveWsBase();

export function useDetectionStream({
  cameraId,
  enabled = true,
  onForbidden,
}: UseDetectionStreamOptions) {
  const [state, setState] = useState<ConnState>("closed");
  const [lastFrame, setLastFrame] = useState<FrameResult | null>(null);
  // onForbidden을 ref로 잡아둬서 콜백 변경이 WebSocket 재연결을 유발하지 않게 함
  const onForbiddenRef = useRef(onForbidden);
  useEffect(() => {
    onForbiddenRef.current = onForbidden;
  }, [onForbidden]);

  useEffect(() => {
    if (!enabled || !cameraId) {
      setState("closed");
      return;
    }

    const url = `${WS_BASE}/its/ws/${encodeURIComponent(cameraId)}`;
    let ws: WebSocket | null = null;
    let cancelled = false;

    setState("connecting");
    try {
      ws = new WebSocket(url);
    } catch {
      setState("error");
      return;
    }

    ws.onopen = () => {
      if (!cancelled) setState("open");
    };
    ws.onmessage = (ev) => {
      if (cancelled) return;
      try {
        const frame = JSON.parse(ev.data) as FrameResult;
        setLastFrame(frame);
        if (frame.forbidden_detections?.length > 0) {
          onForbiddenRef.current?.(frame);
        }
      } catch {
        // 파싱 실패는 무시 (잘못된 메시지 형식)
      }
    };
    ws.onerror = () => {
      if (!cancelled) setState("error");
    };
    ws.onclose = () => {
      if (!cancelled) setState("closed");
    };

    return () => {
      cancelled = true;
      try {
        ws?.close();
      } catch {}
    };
  }, [cameraId, enabled]);

  return { state, lastFrame };
}
