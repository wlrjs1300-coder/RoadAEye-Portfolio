"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./register.module.css";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

// 휴대폰 번호 포맷팅 헬퍼 함수 (3자리-4자리-4자리)
const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  
  const phoneNumber = value.replace(/[^\d]/g, "");
  const phoneNumberLength = phoneNumber.length;

  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  }
  if (phoneNumberLength < 11) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  }
  
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
};

export default function RegisterPage() {
  usePageTitle("회원가입");
  const { showAlert } = useModal();
  const router = useRouter();

  const [formData, setFormData] = useState({
    login_id: "",
    password: "",
    confirmPassword: "",
    email: "",
    name: "",
    birth_date: "",
    phone: "",
    address: "",
  });

  // 생년월일 3분할 상태
  const [birthYear,  setBirthYear]  = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay,   setBirthDay]   = useState("");

  // 연/월 변경 시 birth_date 조합
  const handleBirth = (
    y: string = birthYear,
    m: string = birthMonth,
    d: string = birthDay,
  ) => {
    if (y && m && d) {
      setFormData(prev => ({
        ...prev,
        birth_date: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
      }));
    }
  };

  // 선택한 연/월 기준 해당 월 일수
  const daysInMonth = (y: string, m: string) => {
    if (!y || !m) return 31;
    return new Date(Number(y), Number(m), 0).getDate();
  };

  const [emailId, setEmailId] = useState("");
  const [emailDomain, setEmailDomain] = useState("naver.com");
  const [isDirectInput, setIsDirectInput] = useState(false);

  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isIdChecked, setIsIdChecked] = useState(false);
  const [addressDetail, setAddressDetail] = useState("");

  // 이용약관 관련 상태
  const [showTerms, setShowTerms] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  // 카카오 우편번호 스크립트 로드
  useEffect(() => { void (async () => {
    const script = document.createElement("script");
    script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
    })(); }, []);

  const openAddressSearch = async () => {
    const daum = (window as any).daum;
    if (!daum) { await showAlert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요."); return; }
    new daum.Postcode({
      oncomplete: (data: any) => {
        const addr = data.roadAddress || data.jibunAddress;
        setFormData(prev => ({ ...prev, address: addr }));
        setAddressDetail("");
      },
    }).open();
  };

  const onDomainSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "direct") {
      setIsDirectInput(true);
      setEmailDomain("");
    } else {
      setIsDirectInput(false);
      setEmailDomain(value);
    }
    setIsCodeSent(false);
    setIsEmailVerified(false);
    setVerificationCode("");
  };

  // 이메일 변경 시 상태 조합만 담당
  useEffect(() => { void (async () => {
    setFormData((prev) => ({
      ...prev,
      email: emailId ? `${emailId}@${emailDomain}` : "",
    }));
    })(); }, [emailId, emailDomain]);

  // 이메일 아이디 직접 타이핑 시 기존 인증 무효화 처리 분리
  const handleEmailIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailId(e.target.value);
    if (isCodeSent || isEmailVerified) {
      setIsCodeSent(false);
      setIsEmailVerified(false);
      setVerificationCode("");
    }
  };

  const resetEmailVerification = () => {
    setIsCodeSent(false);
    setIsEmailVerified(false);
    setVerificationCode("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "phone") {
      setFormData({ ...formData, phone: formatPhoneNumber(value) });
    } else {
      setFormData({ ...formData, [name]: value });
      if (name === "login_id") setIsIdChecked(false);
    }
  };

  // 🌟 중복 확인 새로고침 방지
  const checkIdDup = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.login_id) {
      await showAlert("아이디를 입력해 주세요.");
      return;
    }
    try {
      await apiCall("/auth/check/login-id", {
        method: "POST",
        body: JSON.stringify({ login_id: formData.login_id }),
      });
      setIsIdChecked(true);
      await showAlert("사용 가능한 아이디입니다.");
    } catch (error: any) {
      console.error(error);
      await showAlert(error.message || "이미 존재하는 아이디입니다.");
    }
  };

  // 🌟 이메일 인증요청 새로고침 방지 (e: React.MouseEvent 추가 및 preventDefault 추가)
  const sendEmailCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.email) {
      await showAlert("이메일을 정확히 입력해 주세요.");
      return;
    }
    try {
      await apiCall("/auth/email/send-code", {
        method: "POST",
        body: JSON.stringify({ email: formData.email }),
      });
      setIsCodeSent(true);
      await showAlert("인증 코드가 발송되었습니다. 이메일을 확인해 주세요.");
    } catch (error: any) {
      console.error(error);
      await showAlert(error.message || "인증 코드 발송에 실패했습니다.");
    }
  };

  // 🌟 코드 확인 버튼 새로고침 방지 (e: React.MouseEvent 추가 및 preventDefault 추가)
  const verifyEmailCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      await showAlert("인증 코드를 입력해 주세요.");
      return;
    }
    try {
      await apiCall("/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          code: verificationCode
        }),
      });
      setIsEmailVerified(true);
      await showAlert("이메일 인증이 완료되었습니다.");
    } catch (error: any) {
      console.error(error);
      await showAlert(error.message || "인증 코드가 일치하지 않습니다.");
    }
  };

  const handleRegisterClick = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isIdChecked) {
      await showAlert("아이디 중복 확인을 완료해 주세요.");
      return;
    }
    if (!isEmailVerified) {
      await showAlert("이메일 인증을 완료해 주세요.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      await showAlert("비밀번호가 일치하지 않습니다.");
      return;
    }

    setShowTerms(true);
  };

  // 🌟 최종 제출 서브밋 방지 추가
  const handleFinalSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!termsAgreed) {
      await showAlert("이용약관에 동의하셔야 가입이 완료됩니다.");
      return;
    }

    try {
      const { confirmPassword, ...registerPayload } = formData;

      const submissionData = {
        ...registerPayload,
        phone: registerPayload.phone.replace(/-/g, ""),
        address: registerPayload.address
          ? `${registerPayload.address}${addressDetail ? " " + addressDetail : ""}`
          : undefined,
      };

      await apiCall("/auth/register", {
        method: "POST",
        body: JSON.stringify(submissionData),
      });

      await showAlert("회원가입이 정상적으로 완료되었습니다!");
      setShowTerms(false);
      router.push("/login");
    } catch (error: any) {
      console.error(error);
      await showAlert(error.message || "회원가입에 실패했습니다. 입력 값을 다시 확인해 주세요.");
    }
  };

  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.registerCard}>
          <div className={styles.header}>
            <Link href="/" className="logo">ROAD <span className="red">A</span> EYE</Link>
            <p className={styles.subtitle}>사용자 계정 생성</p>
          </div>

          <form onSubmit={handleRegisterClick} className={styles.form}>
            {/* 이름 / 생년월일 */}
            <div className={styles.inputBox}>
              <label>이름</label>
              <input name="name" type="text" value={formData.name} onChange={handleChange} required />
            </div>
            <div className={styles.inputBox}>
              <label>생년월일</label>
              <div className={styles.birthGroup}>
                <select
                  className={styles.birthSelect}
                  value={birthYear}
                  onChange={e => { setBirthYear(e.target.value); handleBirth(e.target.value, birthMonth, birthDay); }}
                  required
                >
                  <option value="">년도</option>
                  {Array.from({ length: new Date().getFullYear() - 1923 - 18 }, (_, i) => new Date().getFullYear() - 18 - i).map(y => (
                    <option key={y} value={String(y)}>{y}년</option>
                  ))}
                </select>
                <select
                  className={styles.birthSelect}
                  value={birthMonth}
                  onChange={e => { setBirthMonth(e.target.value); handleBirth(birthYear, e.target.value, birthDay); }}
                  required
                >
                  <option value="">월</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={String(m)}>{m}월</option>
                  ))}
                </select>
                <select
                  className={styles.birthSelect}
                  value={birthDay}
                  onChange={e => { setBirthDay(e.target.value); handleBirth(birthYear, birthMonth, e.target.value); }}
                  required
                >
                  <option value="">일</option>
                  {Array.from({ length: daysInMonth(birthYear, birthMonth) }, (_, i) => i + 1).map(d => (
                    <option key={d} value={String(d)}>{d}일</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 아이디 / 휴대폰 번호 */}
            <div className={styles.inputBox}>
              <label>아이디</label>
              <div className={styles.inputGroup}>
                <input name="login_id" type="text" value={formData.login_id} placeholder="4~50자 미만" onChange={handleChange} required />
                <button type="button" onClick={(e) => checkIdDup(e)} className={styles.sideBtn}>중복확인</button>
              </div>
            </div>
            
            <div className={styles.inputBox}>
              <label>휴대폰 번호</label>
              <input 
                name="phone" 
                type="tel" 
                placeholder="010-1234-5678" 
                value={formData.phone} 
                maxLength={13}        
                onChange={handleChange} 
                required 
              />
            </div>


            <div className={`${styles.inputBox} ${styles.fullWidth}`}>
              <label>주소</label>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  placeholder="주소 찾기 버튼을 클릭하여 주소를 검색해 주세요"
                  value={formData.address}
                  readOnly
                  className={styles.addressReadonly}
                />
                <button type="button" onClick={openAddressSearch} className={styles.addressSearchBtn}>
                  주소 찾기
                </button>
              </div>
              {formData.address && (
                <input
                  type="text"
                  placeholder="상세주소 입력 (동, 호수, 층 등)"
                  value={addressDetail}
                  onChange={e => setAddressDetail(e.target.value)}
                  style={{ marginTop: "6px" }}
                />
              )}
            </div>

            {/* 이메일 */}
            <div className={`${styles.inputBox} ${styles.fullWidth}`}>
              <label>이메일</label>
              <div className={styles.emailGroup}>
                <input
                  type="text"
                  placeholder="아이디"
                  value={emailId}
                  onChange={handleEmailIdChange}
                  disabled={isEmailVerified}
                  className={styles.emailIdInput}
                />
                <span className={styles.atSymbol}>@</span>

                {isDirectInput && (
                  <input
                    type="text"
                    placeholder="도메인 입력"
                    value={emailDomain}
                    onChange={(e) => {
                      setEmailDomain(e.target.value);
                      resetEmailVerification();
                    }}
                    disabled={isEmailVerified}
                    className={styles.domainInput}
                  />
                )}

                <select
                  className={styles.domainSelect}
                  value={isDirectInput ? "direct" : emailDomain}
                  onChange={onDomainSelect}
                  disabled={isEmailVerified}
                >
                  <option value="naver.com">naver.com</option>
                  <option value="gmail.com">gmail.com</option>
                  <option value="daum.net">daum.net</option>
                  <option value="direct">직접 입력</option>
                </select>

                <button
                  type="button"
                  onClick={(e) => {
                    if (isEmailVerified) {
                      resetEmailVerification();
                      return;
                    }
                    sendEmailCode(e);
                  }} // 🌟 e 전달하도록 바인딩 수정
                  disabled={!isEmailVerified && (!emailId || !emailDomain)}
                  className={styles.sideBtn}
                >
                  {isEmailVerified ? "이메일 변경" : isCodeSent ? "재발송" : "인증요청"}
                </button>
              </div>

              {/* 인증 코드 input 태그 */}
              {isCodeSent && !isEmailVerified && (
                <div className={styles.inputGroup} style={{ marginTop: "8px" }}>
                  <input 
                    placeholder="코드 6자리" 
                    value={verificationCode}
                    maxLength={6}
                    onChange={(e) => setVerificationCode(e.target.value)} 
                  />
                  <button type="button" onClick={(e) => verifyEmailCode(e)} className={styles.sideBtn}>확인</button>
                </div>
              )}
            </div>

            {/* 비밀번호 세트 */}
            <div className={styles.inputBox}>
              <label>비밀번호</label>
              <input name="password" value={formData.password} placeholder="8자 이상, 영문·숫자·특수문자 포함" type="password" onChange={handleChange} required />
            </div>
            <div className={styles.inputBox}>
              <label>비밀번호 확인</label>
              <input name="confirmPassword" value={formData.confirmPassword} placeholder="비밀번호를 다시 입력해 주세요" type="password" onChange={handleChange} required />
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              style={{ opacity: (isIdChecked && isEmailVerified) ? 1 : 0.6 }}
            >
              가입하기
            </button>
          </form>
        </div>
      </div>

      {/* 이용약관 모달 팝업 */}
      {showTerms && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Road A Eye 이용약관</h3>
            <div className={styles.termsBox}>
              <h4>제 1 조 (목적)</h4>
              <p>본 약관은 Road A Eye 팀이 제공하는 AI 기반 CCTV 도로 안전 및 차량 모니터링 웹서비스(이하 "서비스")의 
                계정 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
              
              <h4>제 2 조 (사용자의 의무 및 보안)</h4>
              <p>1. 본 서비스는 도로 교통 안전 관제를 목적으로 하는 시스템이므로, 가입 승인된 사용자는 양도받은 권한을 오직 공익 및 지정된 업무 목적으로만 사용해야 합니다.</p>
              <p>2. 사용자는 시스템을 통해 조회된 차량 번호, CCTV 영상 및 관제 데이터를 외부로 무단 유출, 캡처 및 사적 복제할 수 없으며, 이를 위반할 시 모든 법적 책임은 회원 본인에게 있습니다.</p>
              <p>3. 사용자는 본인의 계정 정보(ID/비밀번호)가 유출되지 않도록 철저히 관리하여야 합니다.</p>

              <h4>제 3 조 (개인정보 보호 및 데이터 활용)</h4>
              <p>1. 사이트는 서비스 제공 및 실시간 모니터링 알림을 위해 회원의 이름, 연락처, 이메일 등의 최소한의 개인정보를 수집합니다.</p>
              <p>2. 시스템이 수집하는 CCTV 격리 데이터 및 통계 자료는 AI 모델 고도화 및 도로 안전 분석 목적으로만 활용되며 관련 법령을 준수합니다.</p>
            </div>

            <label className={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={termsAgreed} 
                onChange={(e) => setTermsAgreed(e.target.checked)} 
              />
              <span>위의 Road A Eye 이용약관 및 사용자 보안 지침에 동의합니다. (필수)</span>
            </label>

            <div className={styles.modalBtns}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowTerms(false)}>취소</button>
              <button 
                type="button" 
                className={styles.confirmBtn} 
                disabled={!termsAgreed}
                onClick={(e) => handleFinalSubmit(e)} // 🌟 e 전달하도록 바인딩 수정
              >
                동의 후 가입완료
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}