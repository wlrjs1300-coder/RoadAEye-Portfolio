import "@/app/globals.css";

export const metadata = {
  metadataBase: new URL("http://mbc-sw.iptime.org:3241"),
  title: "ROAD A EYE — 고속도로 AI 관제",
  description: "고속도로 무단 진입 탐지 AI 플랫폼",
  openGraph: {
    title: "ROAD A EYE — 고속도로 AI 관제",
    description: "고속도로 CCTV 기반 AI 위험 물체 감지 관제 시스템",
    images: ["/images/logo.png"],
    url: "http://mbc-sw.iptime.org:3241/",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* 페인트 전에 저장된 테마를 적용해 새로고침 시 라이트/다크 깜빡임 방지 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
