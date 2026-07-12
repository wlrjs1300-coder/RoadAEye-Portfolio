"use client";
import { CheckCircle } from "lucide-react";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiCall } from "@/api/client";

// ── 정지 계정 모달 (인라인) ──────────────────────────────────────────────────
function SuspendedModal({ loginId, onClose }: { loginId: string; onClose: () => void }) {
  const router = useRouter();
  const [view, setView] = useState<"alert" | "inquiry">("alert");
  const [form, setForm] = useState({ login_id: loginId, email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleInquiry = async () => {
    if (!form.email.trim() || !form.message.trim()) { alert("이메일과 문의사항을 입력해 주세요."); return; }
    setSending(true);
    try {
      await apiCall("/board/inquiries/anonymous", {
        method: "POST",
        body: JSON.stringify({ title: `[계정 정지 문의] ${form.login_id}`, content: `아이디: ${form.login_id}\n이메일: ${form.email}\n\n${form.message}` }),
      });
      setSent(true);
    } catch { alert("문의 전송에 실패했습니다."); }
    finally { setSending(false); }
  };

  const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" };
  const card: React.CSSProperties = { background: "var(--bg-card,#fff)", borderRadius: 16, padding: "32px 28px", width: "min(92vw,420px)", boxShadow: "0 8px 40px rgba(0,0,0,0.22)" };
  const btn = (bg: string): React.CSSProperties => ({ flex: 1, padding: "11px 0", borderRadius: 8, border: bg === "transparent" ? "1.5px solid #e5e7eb" : "none", background: bg, color: bg === "transparent" ? "#0f172a" : "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 });
  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", boxSizing: "border-box", fontSize: 14 };

  return (
    <div style={overlay}>
      <div style={card}>
        {view === "alert" ? (<>
          <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>🚫</div>
          <h3 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>정지된 아이디입니다</h3>
          <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginBottom: 28 }}>해당 계정은 관리자에 의해 사용이 정지되었습니다.<br />문의가 필요하시면 아래 버튼을 눌러주세요.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btn("#e11d48")} onClick={() => { onClose(); router.push("/login"); }}>확인</button>
            <button style={btn("transparent")} onClick={() => setView("inquiry")}>문의하기</button>
          </div>
        </>) : sent ? (<>
          <div style={{ width: "54px", height: "54px", margin: "0 auto 14px", borderRadius: "50%", background: "rgba(225, 29, 72, 0.1)", color: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle size={28} /></div>
          <h3 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>문의가 접수되었습니다</h3>
          <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginBottom: 28 }}>확인 후 이메일로 답변 드리겠습니다.</p>
          <button style={{ ...btn("#e11d48"), width: "100%" }} onClick={() => { onClose(); router.push("/login"); }}>확인</button>
        </>) : (<>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>계정 정지 문의</h3>
          {([ ["아이디", "login_id", "text", true], ["이메일", "email", "email", false] ] as [string, string, string, boolean][]).map(([label, key, type, ro]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{label}</label>
              <input type={type} value={form[key as keyof typeof form]} readOnly={ro}
                onChange={e => !ro && setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ ...inputStyle, background: ro ? "#f8fafc" : undefined }} />
            </div>
          ))}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>문의사항</label>
            <textarea rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="문의하실 내용을 입력해 주세요." style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btn("transparent")} onClick={() => setView("alert")}>뒤로</button>
            <button style={{ ...btn("#e11d48"), opacity: sending ? 0.7 : 1 }} disabled={sending} onClick={handleInquiry}>
              {sending ? "전송 중..." : "문의 보내기"}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── 소셜 로그인 콜백 처리 ────────────────────────────────────────────────────
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [suspendedId, setSuspendedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // 정지 계정 리다이렉트 처리 (백엔드에서 ?error=suspended 로 전달)
      const errorParam = searchParams.get("error");
      const loginIdParam = searchParams.get("login_id") ?? "";
      if (errorParam === "suspended") {
        router.push("/login?suspended=1&login_id=" + encodeURIComponent(loginIdParam));
        return;
      }

      const token = searchParams.get("token");
      if (!token) { router.push("/login"); return; }

      localStorage.setItem("access_token", token);

      try {
        const API_URL = "/api/proxy";
        const res = await fetch(API_URL + "/auth/me", {
          headers: { Authorization: "Bearer " + token },
        });

        if (res.status === 403) {
          // 정지된 계정
          localStorage.removeItem("access_token");
          setSuspendedId(loginIdParam);
          return;
        }

        const data = await res.json();
        if (data.user_no) {
          localStorage.setItem("user", JSON.stringify(data));
          window.dispatchEvent(new Event("login-state-changed"));
          router.push(data.role === "admin" ? "/dashboard" : "/main");
        } else {
          router.push("/main");
        }
      } catch {
        router.push("/main");
      }
    };
    load();
  }, [searchParams, router]);

  if (suspendedId !== null) {
    return <SuspendedModal loginId={suspendedId} onClose={() => setSuspendedId(null)} />;
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <p>소셜 로그인 인증을 처리 중입니다. 잠시만 기다려 주세요...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>페이지를 로딩하고 있습니다...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
