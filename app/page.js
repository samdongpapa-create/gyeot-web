"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [detail, setDetail] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const [paidLoading, setPaidLoading] = useState(false);
  const [paidReport, setPaidReport] = useState("");
  const [paidError, setPaidError] = useState("");

  async function analyzeFree() {
    setError("");
    setResult(null);
    setPaidReport("");
    setPaidError("");

    if (!url.trim()) {
      setError("네이버 플레이스 주소를 입력해줘.");
      return;
    }

    setLoading(true);
    try {
     const res = await fetch("/api/analyze/free", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: url.trim(),
    keywords: keywords.trim(),
    detail: detail.trim(),
  }),
});

const text = await res.text();

// JSON이 아닐 수도 있으니 안전 파싱
let data = null;
try {
  data = text ? JSON.parse(text) : null;
} catch (e) {
  throw new Error(
    "서버 응답이 JSON이 아니야. (배포 로그/에러 확인 필요)\n\n응답 일부:\n" +
      text.slice(0, 200)
  );
}

if (!res.ok) throw new Error(data?.error || "분석에 실패했어.");
setResult(data);


      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "분석에 실패했어.");
      setResult(data);
    } catch (e) {
      setError(e.message || "알 수 없는 오류가 발생했어.");
    } finally {
      setLoading(false);
    }
  }

  async function analyzePaid() {
    setPaidError("");
    setPaidReport("");

    if (!url.trim()) {
      setPaidError("네이버 플레이스 주소를 입력해줘.");
      return;
    }

    // 결제 전 단계: 일단 확인창
    const ok = confirm("유료 리포트를 생성할까요? (현재는 결제 연동 전, 테스트용입니다)");
    if (!ok) return;

    setPaidLoading(true);
    try {
      const res = await fetch("/api/analyze/paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          keywords: keywords.trim(),
          detail: detail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "유료 리포트 생성 실패");
      setPaidReport(data?.paid_report || "");
    } catch (e) {
      setPaidError(e.message || "알 수 없는 오류");
    } finally {
      setPaidLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "white", color: "#111" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 20px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>
          네이버 플레이스 분석기 (MVP)
        </h1>
        <p style={{ marginTop: 8, color: "#555" }}>
          플레이스 주소를 넣으면 <b>대표 키워드 · 상세설명 · 이미지</b> 기준으로
          무료 요약 + 수정 포인트 1개, 그리고 유료 리포트를 생성합니다.
        </p>

        {/* URL */}
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="네이버 플레이스 URL (m.place / place 둘 다 가능)"
          style={{
            width: "100%",
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
          }}
        />

        {/* 보완 입력 */}
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="대표 키워드 (선택, 쉼표로 구분)"
          style={{
            width: "100%",
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
          }}
        />

        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="플레이스 상세설명 (선택, 복사해서 붙여넣기)"
          rows={5}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
          }}
        />

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={analyzeFree}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "무료 분석 중..." : "무료 분석"}
          </button>

          <button
            onClick={analyzePaid}
            disabled={paidLoading}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#f7f7f7",
              cursor: "pointer",
              opacity: paidLoading ? 0.6 : 1,
            }}
          >
            {paidLoading ? "유료 리포트 생성 중..." : "유료 리포트 생성(테스트)"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 14, color: "#a40000" }}>{error}</div>
        )}

        {result && (
          <div style={{ marginTop: 24, border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              {result?.extracted?.image && (
                <img
                  src={result.extracted.image}
                  alt="대표 이미지"
                  style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 260 }}>
                <h2 style={{ margin: 0 }}>{result?.extracted?.title || "플레이스명(추출 실패)"}</h2>
                <p style={{ marginTop: 6, color: "#555", lineHeight: 1.6 }}>
                  {result?.extracted?.desc || "설명 추출 실패"}
                </p>
                <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
                  placeId: {result?.place_id || "-"} <br />
                  analyzed: {result?.analyzed_url || "-"}
                </div>
              </div>
            </div>

            <hr style={{ margin: "16px 0" }} />

            <div style={{ fontWeight: 800, marginBottom: 8 }}>무료 리포트</div>
            <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>
              {result?.free_report || "무료 리포트 생성 실패"}
            </pre>
          </div>
        )}

        {paidError && (
          <div style={{ marginTop: 14, color: "#a40000" }}>{paidError}</div>
        )}

        {paidReport && (
          <div style={{ marginTop: 24, border: "1px solid #111", borderRadius: 16, padding: 16 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>유료 리포트</div>
            <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>
              {paidReport}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
