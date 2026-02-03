export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "white", color: "#111" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
        <h1 style={{ fontSize: 32, lineHeight: 1.2, fontWeight: 700 }}>
          아무도
          <br />
          괜찮냐고
          <br />
          물어보지 않을 때가 있어.
        </h1>

        <p style={{ marginTop: 28, fontSize: 16, lineHeight: 1.7, color: "#444" }}>
          잘 지내는 것처럼 보여야 할 때가 있고,
          <br />
          괜찮지 않은 걸 굳이 설명하고 싶지 않을 때도 있어.
          <br />
          그게 이상한 건 아니야.
        </p>

        <div
          style={{
            marginTop: 28,
            border: "1px solid #e5e5e5",
            borderRadius: 18,
            padding: 18
          }}
        >
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            <b>곁</b>은 조언하지 않는 공간이야.
            <br />
            판단하지도 않고, 답을 재촉하지도 않아.
            <br />
            그냥 네가 말한 걸 잊지 않으려고 해.
          </p>

          <p style={{ marginTop: 10, fontSize: 13, color: "#666", lineHeight: 1.6 }}>
            여기서 한 말은 공개되지 않아. 원하지 않으면 꺼내지도 않아.
          </p>

          <a
            href="/chat"
            style={{
              display: "inline-block",
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #ddd",
              color: "#111",
              textDecoration: "none"
            }}
          >
            곁에 말 걸기
          </a>
        </div>
      </div>
    </main>
  );
}
