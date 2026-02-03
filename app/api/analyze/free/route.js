export const runtime = "nodejs";

import OpenAI from "openai";

/* ---------- URL 정규화 ---------- */
function normalizeNaverPlaceUrl(input) {
  let u;
  try {
    u = new URL(input.trim());
  } catch {
    return { ok: false };
  }

  const m =
    u.pathname.match(/\/place\/(\d+)/) ||
    u.pathname.match(/\/(\d+)/);

  const placeId = m?.[1];
  if (!placeId) return { ok: false };

  return {
    ok: true,
    placeId,
    desktop: `https://place.naver.com/place/${placeId}`,
    mobile: `https://m.place.naver.com/place/${placeId}`,
  };
}

/* ---------- HTML fetch ---------- */
async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

/* ---------- HTML helpers ---------- */
function pickMeta(html, property) {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)`,
    "i"
  );
  return html.match(re)?.[1] || "";
}

function stripTags(s) {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/* ---------- FREE PROMPT ---------- */
const FREE_PROMPT = `
너는 네이버 플레이스 로컬 SEO를 분석하는 전문가다.
아래 정보를 바탕으로 사장님이 이해하기 쉬운 말로
가장 큰 손실 포인트 1가지를 짚어라.

[입력 정보]
- 플레이스명: {{place_name}}
- 현재 대표 키워드: {{current_keywords}}
- 상세 설명 텍스트: {{description_text}}
- 이미지 정보:
  - 전체 이미지 수: {{image_count}}
  - 대표 이미지 여부: {{has_main_image}}

[출력 형식]
1. 한 줄 요약
2. 가장 아쉬운 포인트 1가지
3. 지금 바로 수정하면 좋은 포인트 1개
`;

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

/* ---------- API ---------- */
export async function POST(req) {
  const { url, keywords, detail } = await req.json();

  const norm = normalizeNaverPlaceUrl(url);
  if (!norm.ok) {
    return new Response(JSON.stringify({ error: "네이버 플레이스 URL이 아닙니다." }), { status: 400 });
  }

  let fetched = await fetchHtml(norm.desktop);
  let usedUrl = norm.desktop;

  if (!fetched.ok) {
    const f2 = await fetchHtml(norm.mobile);
    if (f2.ok) {
      fetched = f2;
      usedUrl = norm.mobile;
    }
  }

  const html = fetched.text || "";
  const title = pickMeta(html, "og:title");
  const descAuto = stripTags(pickMeta(html, "og:description"));
  const image = pickMeta(html, "og:image");

  const vars = {
    place_name: title || "알 수 없음",
    current_keywords: keywords || "미입력",
    description_text: detail || descAuto || "미확인",
    image_count: image ? "1+" : "0",
    has_main_image: image ? "예" : "아니오",
  };

  const prompt = fill(FREE_PROMPT, vars);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.4,
    messages: [{ role: "user", content: prompt }],
  });

  return new Response(
    JSON.stringify({
      place_id: norm.placeId,
      analyzed_url: usedUrl,
      extracted: { title, desc: descAuto, image },
      free_report: completion.choices[0].message.content,
    }),
    { status: 200 }
  );
}
