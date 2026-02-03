"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [paidLoading, setPaidLoading] = useState(false);

  const [error, setError] = useState("");
  const [paidError, setPaidError] = useState("");

  const [freeData, setFreeData] = useState(null);
  const [paidReport, setPaidReport] = useState("");

  async function safeFetchJson(path, payload) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(
        `서버 응답이 JSON이 아니야.\n\n응답 일부:\n${(text || "").slice(0, 300)}`
      );
    }

    if (!res.ok) throw new Error(json?.error || "요청 실패");
    return json;
  }

  async function onFree() {
    setError("");
    setFreeData(null);
    setPaidReport("");
    setPaidError("");

    if (!url.trim()) {
      setError("네이버 플레이스 URL을 입력해줘.");
      return;
    }

    setLoading(true);
    try {
      const data = await safeFetchJson("/api/analyze/free", { url: url.trim() });
      setFreeData(data);
    } catch (e) {
      setError(e.message || "오류");
    } finally {
      setLoading(false);
    }
  }

  async function onPaid() {
    setPaidError("");
    setPaidReport("");

    if (!url.trim()) {
      setPaidError("네이버 플레이스 URL을 입력해줘.");
      return;
    }

    const ok = confirm("유료 리포트를 생성할까요? (현재는 결제 연동 전, 테스트)");
    if (!ok) return;

    setPaidLoading(true);
    try {
      const data = await safeFetchJson("/api/analyze/paid", { url: url.trim() });
      setPaidReport(data?.paid_report || "");
    } catch (e) {
      setPaidError(e.message || "오류");
    } finally {
      setPaidLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#fff", color: "#111" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "56px 20px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>네이버 플레이스 분석기</h1>
        <p style={{ marginTop: 8, color: "#555" }}>
          URL만 입력하면 <b>키워드/상세설명/이미지</b>를 자동 추출하고,
          무료/유료 리포트를 생성합니다.
        </p>

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

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={onFree}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "무료 분석 중..." : "무료 분석"}
          </button>

          <button
            onClick={onPaid}
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
            {paidLoading ? "유료 리포트 생성 중..." : "유료 리포트(테스트)"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 14, color: "#a40000", whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        )}

        {freeData && (
          <div style={{ marginTop: 24, border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {freeData?.extracted?.mainImage && (
                <img
                  src={freeData.extracted.mainImage}
                  alt="대표 이미지"
                  style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 12 }}
                />
              )}

              <div style={{ flex: 1, minWidth: 280 }}>
                <h2 style={{ margin: 0 }}>
                  {freeData?.extracted?.name || "플레이스명(추출 실패)"}
                </h2>

                <div style={{ fontSize: 12, color: "#777", marginTop: 6, lineHeight: 1.6 }}>
                  placeId: {freeData?.place_id || "-"} <br />
                  analyzed: {freeData?.analyzed_url || "-"} <br />
                  fetch_failed: {String(!!freeData?.fetch_failed)}
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>자동 추출 키워드</div>
                  <div style={{ color: "#333", lineHeight: 1.6 }}>
                    {(freeData?.extracted?.keywords || []).join(", ") || "없음"}
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>자동 추출 상세설명</div>
                  <div style={{ color: "#333", lineHeight: 1.6 }}>
                    {freeData?.extracted?.description || "없음"}
                  </div>
                </div>
              </div>
            </div>

            <hr style={{ margin: "16px 0" }} />

            <div style={{ fontWeight: 900, marginBottom: 8 }}>무료 리포트</div>
            <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>
              {freeData?.free_report || "리포트 없음"}
            </pre>
          </div>
        )}

        {paidError && (
          <div style={{ marginTop: 14, color: "#a40000", whiteSpace: "pre-wrap" }}>
            {paidError}
          </div>
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
