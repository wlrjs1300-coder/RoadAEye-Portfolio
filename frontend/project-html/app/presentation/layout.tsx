import type { Metadata } from "next";

export const metadata: Metadata = { title: "발표 자료 | Road A Eye" };

export default function PresentationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <style>{`
        header, nav, [class*="Header"],
        #chat-bubble, #chat-window {
          display: none !important;
        }
        .page-transition-wrap {
          animation: none !important;
          position: fixed !important;
          inset: 0 !important;
          overflow: hidden !important;
        }
      `}</style>
      {children}
    </>
  );
}
