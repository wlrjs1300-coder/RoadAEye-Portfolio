"use client";

import {
  Info,
  Cctv,
  BarChart3,
  ShieldCheck,
  ClipboardList,
  Bell,
  Settings,
  Mail,
  Lock,
  UserMinus,
  LogOut,
  Menu,
  X,
  Presentation,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import Link from "next/link";
import { getUnreadCount } from "@/lib/notifications";

export default function Header() {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 클릭으로 닫힌 직후 짧은 시간 동안 hover 재오픈을 막는 락
  // (서브메뉴 display:none 전환·페이지 이동 중 발생하는 spurious mouseenter 차단)
  const closeLock = useRef(false);
  const closeLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter(); // 💡 userName도 실시간 State로 변경
  const pathname = usePathname();

  useEffect(() => {
    // 로그인 상태 확인 함수
    const checkLoginStatus = () => {
      const token = localStorage.getItem("access_token");
      const savedUser = localStorage.getItem("user");

      if (token) {
        setIsLoggedIn(true);
        if (savedUser) {
          try {
            const userObj = JSON.parse(savedUser);
            const placeholders = ["사용자", "카카오사용자", "구글사용자", "네이버사용자"];
            const rawName = userObj.name || "";
            const displayName = (!rawName || placeholders.includes(rawName))
              ? (userObj.email ? userObj.email.split("@")[0] : (userObj.login_id || ""))
              : rawName;
            setUserName(displayName);
            setUserRole(userObj.role || "");
          } catch (e) {
            console.error("유저 정보 파싱 에러", e);
          }
        }
      } else {
        setIsLoggedIn(false);
        setUserName("");
      }
    };

    // 초기 로드 시 상태 확인
    checkLoginStatus();

    // 💡 localStorage 변경을 감지하는 이벤트 리스너 추가
    // 같은 탭에서 다른 곳에서 localStorage 변경 시 감지
    window.addEventListener("storage", checkLoginStatus);

    // 💡 커스텀 이벤트로도 감지 (같은 탭에서 로그인할 때)
    window.addEventListener("login-state-changed", checkLoginStatus);

    return () => {
      window.removeEventListener("storage", checkLoginStatus);
      window.removeEventListener("login-state-changed", checkLoginStatus);
    };
  }, []);

  // 읽지 않은 알림 개수 — localStorage 기준, 변경 이벤트 발생 시 갱신
  useEffect(() => {
    const refresh = () => setUnreadCount(getUnreadCount());
    refresh();
    window.addEventListener("notifications-changed", refresh);
    window.addEventListener("settings-changed", refresh);
    window.addEventListener("login-state-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("notifications-changed", refresh);
      window.removeEventListener("settings-changed", refresh);
      window.removeEventListener("login-state-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (userMenuTimer.current) clearTimeout(userMenuTimer.current);
    };
  }, []);

  // 라우트가 바뀌면(=링크 클릭으로 페이지가 실제로 이동되면) 메뉴 강제 닫음
  useEffect(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setIsHovered(false);
    setIsMenuOpen(false);
  }, [pathname]);

  const closeMenu = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (closeLockTimer.current) clearTimeout(closeLockTimer.current);
    closeLock.current = true;
    setIsHovered(false);
    setIsMenuOpen(false);
    closeLockTimer.current = setTimeout(() => {
      closeLock.current = false;
    }, 500);
  };

  const openUserMenu = () => {
    if (userMenuTimer.current) clearTimeout(userMenuTimer.current);
    setIsUserMenuOpen(true);
  };

  const closeUserMenuWithDelay = () => {
    if (userMenuTimer.current) clearTimeout(userMenuTimer.current);
    userMenuTimer.current = setTimeout(() => setIsUserMenuOpen(false), 500);
  };

  // 💡 로그아웃 시 저장소 비우고 홈으로 리다이렉트 처리까지 해주면 깔끔합니다.
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    setUserName("");
    // 💡 로그아웃 상태 변경 이벤트 발생
    setUserRole("");
    window.dispatchEvent(new Event("login-state-changed"));
    window.location.href = "/main"; // 메인 페이지로 튕겨내기
  };


  // sub 항목은 문자열(기존 메뉴 호환) 또는 객체({name, href, adminOnly}) 둘 다 허용
  type SubItem = string | { name: string; href: string; adminOnly?: boolean };
  type MenuItem = {
    title: string;
    icon: React.ReactNode;
    href?: string;            // 정의되면 sub 없이 단일 링크로 렌더링
    sub?: SubItem[];
    adminOnly?: boolean;
    loginOnly?: boolean;      // true면 로그인한 사용자만 표시
  };

  // 메인 네비게이션 메뉴
  const menuItems: MenuItem[] = [
    {
      title: "ROAD A EYE",
      icon: <Info size={24} />,
      sub: ["프로젝트 개요", "개발 정보"],
    },
    {
      // 운영(실시간) 메뉴 — 대시보드 + 스트림 관리 (관리자 전용)
      title: "통합 관제 시스템",
      icon: <Cctv size={24} />,
      adminOnly: true,
      sub: [
        { name: "통합 관제 대시보드", href: "/dashboard" },
        { name: "스트림 관리",         href: "/monitoring/streams" },
        { name: "AI 모델 비교",        href: "/monitoring/ai-test" },
      ],
    },
    {
      // 새 분석 메뉴 — 로그인 필수. 항목별 권한 차등 (감지기록·모델은 관리자 전용)
      title: "분석 센터",
      icon: <BarChart3 size={24} />,
      loginOnly: true,
      sub: [
        { name: "통계 리포트",    href: "/analysis/stats" },
        { name: "위험 구간 지도", href: "/analysis/heatmap" },
        { name: "감지 기록",       href: "/analysis/detections", adminOnly: true },
        { name: "AI 모델 관리",    href: "/analysis/models",      adminOnly: true },
      ],
    },
    {
      title: "게시판",
      icon: <ClipboardList size={24} />,
      sub: [
        "공지사항",
        { name: "자주 묻는 질문", href: "/board/faq" },
        "1:1 문의",
        { name: "버그 게시판",    href: "/board/bug" },
        { name: "자료 게시판",    href: "/board/resources" },
      ],
    },
  ];

  return (
    <header
      id="header"
      className={`${isHovered ? "expanded" : ""} ${isMenuOpen ? "mobile-open" : ""} ${userRole === "admin" ? "role-admin" : "role-standard"}`}
    >
      <div className="nav-container">
        {/* 1. 모바일 햄버거 버튼 */}
        <button
          className="mobile-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className="logo">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Link
              href="/"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <img
                src="/images/logo.png"
                alt="ROAD A EYE Logo"
                className="logo-img logo-light"
                style={{ height: '45px', width: 'auto' }}
              />
              <img
                src="/images/logo_dark.png"
                alt="ROAD A EYE Logo"
                className="logo-img logo-dark"
                style={{ height: '45px', width: 'auto' }}
              />
            </Link>
          </div>
        </div>

        {/* 2. 중앙 메뉴 (동적 경로 연결 수정) */}
        <nav
          className={`menu ${isMenuOpen ? "active" : ""}`}
          onMouseEnter={() => {
            if (closeLock.current) return;
            if (leaveTimer.current) clearTimeout(leaveTimer.current);
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            leaveTimer.current = setTimeout(() => {
              setIsHovered(false);
            }, 300);
          }}
        >
          {menuItems.map((item, idx) => {
            if (item.adminOnly && userRole !== "admin") return null;
            if (item.loginOnly && !isLoggedIn) return null;

            // 1) 단일 링크 메뉴 (sub 없음, item.href 정의됨) — 호버 드롭다운 없이 클릭 시 바로 이동
            if (item.href) {
              return (
                <div key={idx} className="menu-column">
                  <Link href={item.href} className="main-menu-a" onClick={closeMenu}>
                    <span className="menu-icon">{item.icon}</span>
                    {item.title}
                  </Link>
                </div>
              );
            }

            // 2) sub 메뉴가 있는 일반 메뉴 — 항목별 adminOnly 필터링 후 렌더링
            const visibleSubs = (item.sub ?? []).filter((s) => {
              if (typeof s === "string") return true;
              return !s.adminOnly || userRole === "admin";
            });

            return (
              <div key={idx} className="menu-column">
                <span className="main-menu-a">
                  <span className="menu-icon">{item.icon}</span>
                  {item.title}
                </span>
                <div
                  className={`sub-menu-list ${isHovered || isMenuOpen ? "visible" : ""}`}
                >
                  {visibleSubs.map((subItem, sIdx) => {
                    // 객체 형태 sub → name·href 직접 사용
                    if (typeof subItem === "object") {
                      return (
                        <Link key={sIdx} href={subItem.href} className="sub-menu-a" onClick={closeMenu}>
                          {subItem.name}
                        </Link>
                      );
                    }

                    // 1:1 문의 — 비로그인 시 로그인 페이지로 이동
                    if (item.title === "게시판" && subItem === "1:1 문의") {
                      return (
                        <a
                          key={sIdx}
                          className="sub-menu-a"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            closeMenu();
                            router.push(isLoggedIn ? "/board/qna" : "/login");
                          }}
                        >
                          {subItem}
                        </a>
                      );
                    }

                    // 문자열 sub → 기존 메뉴들의 경로 매핑
                    let targetHref = "/";
                    if (item.title === "게시판") {
                      if (subItem === "공지사항") targetHref = "/board/notice";
                      else if (subItem === "자주 묻는 질문") targetHref = "/board/faq";
                    } else if (item.title === "ROAD A EYE") {
                      targetHref = subItem === "프로젝트 개요" ? "/about/intro" : "/about/info";
                    }

                    return (
                      <Link key={sIdx} href={targetHref} className="sub-menu-a" onClick={closeMenu}>
                        {subItem}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* 3. 우측 사용자 액션 메뉴 */}
        <div className="actions">
          {isLoggedIn ? (
            <>
              {/* 알림 — 클릭 시 알림 이력 페이지로 이동, 안 읽은 개수 배지 표시 */}
              <Link href="/history" className="action-btn notification-bell" title="알림 이력">
                <Bell size={24} />
                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              {/* 환경설정 — 클릭 시 설정 페이지로 이동 */}
              <Link href="/settings" className="action-btn" title="환경설정">
                <Settings size={24} />
              </Link>

              {/* 마이페이지 */}
              <div className="action-item-group" onMouseEnter={openUserMenu} onMouseLeave={closeUserMenuWithDelay}>
                <button className="user-profile-btn" aria-haspopup="menu" aria-expanded={isUserMenuOpen}>
                  <span>{userName ? `${userName}님` : "사용자님"}</span>
                </button>

                <div className={`user-dropdown ${isUserMenuOpen ? "visible" : ""}`} role="menu" aria-label="사용자 메뉴">
                  <section className="dropdown-section">
                    <div className="dropdown-header">
                      <span>내 계정</span>
                    </div>
                    <div className="dropdown-section-body">
                      <Link href="/profile/email" className="dropdown-menu-link" role="menuitem">
                        <span className="dropdown-icon"><Mail size={18} /></span>
                        <span>SMS / 이메일 설정</span>
                      </Link>
                      <Link href="/profile/edit" className="dropdown-menu-link" role="menuitem">
                        <span className="dropdown-icon"><Lock size={18} /></span>
                        <span>개인 정보 변경</span>
                      </Link>
                      <Link href="/profile/delete" className="dropdown-menu-link danger-text" role="menuitem">
                        <span className="dropdown-icon"><UserMinus size={18} /></span>
                        <span>회원 탈퇴</span>
                      </Link>
                      <button className="dropdown-menu-link dropdown-action" onClick={handleLogout} role="menuitem">
                        <span className="dropdown-icon"><LogOut size={18} /></span>
                        <span>로그아웃</span>
                      </button>
                    </div>
                  </section>

                  {userRole === "admin" && (
                    <section className="dropdown-section">
                      <div className="dropdown-header">
                        <span>관리자</span>
                      </div>
                      <div className="dropdown-section-body">
                        <Link href="/admin/manage" className="dropdown-menu-link" role="menuitem">
                          <span className="dropdown-icon"><ShieldCheck size={18} /></span>
                          <span>관리자 시스템</span>
                        </Link>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </>
          ) : (
            <Link href="/login">
              <button className="login-trigger">로그인</button>
            </Link>
          )}
          {userRole === "admin" && (
            <Link href="/presentation" className="presentation-shortcut-btn" title="발표 자료" aria-label="발표 자료">
              <Presentation size={22} />
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
      <div
        className={`header-bg-panel ${isHovered ? "visible" : ""}`}
        onMouseEnter={() => {
          if (closeLock.current) return;
          if (leaveTimer.current) clearTimeout(leaveTimer.current);
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          leaveTimer.current = setTimeout(() => setIsHovered(false), 300);
        }}
      />
    </header>
  );
}