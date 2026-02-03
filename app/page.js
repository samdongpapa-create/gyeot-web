"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function analyzeFree() {
    setError("");
    setResult(null);

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

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "분석에 실패했어.");
      setResult(data);
    } catch (e) {
      setError(e.message || "알 수 없는 오류가 발생했어.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "white", color: "#111" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "56px 20px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>
          네이버 플레이스 분석기 (MVP)
        </h1>
        <p style={{ marginTop: 8, color: "#555" }}>
          플레이스 주소를 넣으면 <b>대표 키워드 · 상세설명 · 이미지</b> 기준으로
          무료 요약 + 수정 포인트 1개를 보여줍니다.
        </p>

        {/* URL */}
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="네이버 플레이스 URL (m.place / place 둘 다 가능)"
          style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />

        {/* 보완 입력 */}
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="대표 키워드 (선택, 쉼표로 구분)"
          style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />

        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="플레이스 상세설명 (선택, 복사해서 붙여넣기)"
          rows={5}
          style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />

        <button
          onClick={analyzeFree}
          disabled={loading}
          style={{
            marginTop: 12,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "분석 중..." : "무료 분석"}
        </button>

        {error && (
          <div style={{ marginTop: 14, color: "#a40000" }}>{error}</div>
        )}

        {result && (
          <div style={{ marginTop: 24, border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", gap: 16 }}>
              {result?.extracted?.image && (
                <img
                  src={result.extracted.image}
                  alt="대표 이미지"
                  style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }}
                />
              )}
              <div>
                <h2 style={{ margin: 0 }}>{result?.extracted?.title}</h2>
                <p style={{ marginTop: 6, color: "#555" }}>
                  {result?.extracted?.desc || "설명 추출 실패"}
                </p>
                <div style={{ fontSize: 12, color: "#777" }}>
                  placeId: {result.place_id} <br />
                  analyzed: {result.analyzed_url}
                </div>
              </div>
            </div>

            <hr style={{ margin: "16px 0" }} />

            <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {result.free_report}
            </pre>

            <button
              onClick={() => alert("유료 리포트는 다음 단계에서 연결합니다.")}
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#f7f7f7",
                cursor: "pointer",
              }}
            >
              유료 리포트 (잠금)
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
