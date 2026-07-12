"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");
  
  // 클라이언트에서만 localStorage 값으로 동기화
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
  }, []);

  // 2. 테마 변경 함수
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  // layout.tsx의 inline script가 이미 theme을 적용했으므로 hydration 불일치 없음
  return (
    <button 
      onClick={toggleTheme} 
      className="theme-toggle-btn"
      aria-label="테마 변경"
    >
      {/* 테마 상태에 따라 Sun 또는 Moon 아이콘 표시 */}
      {theme === "dark" ? (
        <Sun size={24} color="white" /> 
      ) : (
        <Moon size={24} color="#e11d48" /> /* 라이트 모드일 때 핫핑크색 적용 */
      )}
    </button>
  );
}