"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function analyzeFree() {
    setError("");
    setResult(null);

    const u = url.trim();
    if (!u) {
      setError("네이버 플레이스 주소를 입력해줘.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
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
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "56px 20px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
          네이버 플레이스 분석기 (MVP)
        </h1>
        <p style={{ marginTop: 10, color: "#555", lineHeight: 1.6 }}>
          플레이스 주소를 넣으면 <b>대표키워드 · 상세설명 · 이미지</b> 기준으로
          무료 요약 + 수정 포인트 1개를 보여줘.
        </p>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="네이버 플레이스 URL 붙여넣기"
            style={{
              flex: 1,
              minWidth: 280,
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={analyzeFree}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "분석 중..." : "무료 분석"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              background: "#fff3f3",
              border: "1px solid #ffd0d0",
              color: "#a40000",
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                {result?.extracted?.image && (
                  <img
                    src={result.extracted.image}
                    alt="대표 이미지"
                    style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 14, border: "1px solid #eee" }}
                  />
                )}

                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {result?.extracted?.title || "플레이스명(추출 실패)"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "#555", lineHeight: 1.6 }}>
                    {result?.extracted?.desc || "설명(추출 실패). 유료 리포트에서는 입력 보완 방식으로 더 정확하게 만들 수 있어."}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
                    이미지 추출: {result?.extracted?.image ? "성공" : "실패"} ·
                    설명 추출: {result?.extracted?.desc ? "성공" : "실패"}
                  </div>
                </div>
              </div>

              <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid #eee" }} />

              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14 }}>
                {result?.free_report || "리포트 생성 실패"}
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => alert("유료 리포트는 다음 단계에서 결제 연결 후 활성화할게.")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: "#111",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  유료 리포트(잠금)
                </button>
                <span style={{ fontSize: 12, color: "#666" }}>
                  유료: 대표키워드 세트 + 상세설명 2안 + 이미지 구성 체크리스트 + 실행 우선순위
                </span>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 12, color: "#777", lineHeight: 1.6 }}>
          * MVP 특성상 네이버 페이지 구조에 따라 일부 정보가 추출되지 않을 수 있어. 그 경우 다음 단계에서
          “부족한 정보만 추가 입력” 방식으로 정확도를 올릴거야.
        </div>
      </div>
    </main>
  );
}
