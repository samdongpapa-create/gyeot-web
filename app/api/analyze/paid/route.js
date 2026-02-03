export const runtime = "nodejs";

import OpenAI from "openai";

/* ---------- URL 정규화 (mobile/desktop 통일) ---------- */
function normalizeNaverPlaceUrl(input) {
  let u;
  try {
    u = new URL(input.trim());
  } catch {
    return { ok: false };
  }

  const m = u.pathname.match(/\/place\/(\d+)/) || u.pathname.match(/\/(\d+)/);
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
    redirect: "follow",
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

function clampText(text, maxChars = 2500) {
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars) + "…";
}

/* ---------- PAID PROMPT ---------- */
const PAID_PROMPT = `
너는 네이버 플레이스 로컬 SEO 및 콘텐츠 최적화 전문가다.
아래 정보를 바탕으로 '대표 키워드 + 상세설명 + 이미지'를 함께 개선하는 유료 리포트를 작성하라.

⚠️ 주의사항
- 순위/노출을 보장하거나 단정하지 말 것
- 과장 없이, 사장님이 바로 실행 가능한 말로 쓸 것
- 추상적인 조언 금지(예: "열심히", "최적화하세요" 금지)
- 바로 복사해서 붙여넣을 수 있는 결과물을 반드시 포함할 것

[입력 정보]
- 플레이스명: {{place_name}}
- (추정) 업종/카테고리: {{category_guess}}
- (추정) 설명 요약: {{desc_short}}
- 현재 대표 키워드(사용자 입력): {{current_keywords}}
- 상세설명(사용자 입력 우선): {{description_text}}
- 대표 이미지 URL(있으면): {{main_image_url}}
- 참고: URL 구조상 일부 정보는 누락될 수 있으며, 누락된 부분은 "가정"이라고 표시할 것

[출력 형식: 아래 제목을 그대로 사용]

1) 진단 요약 (3~6줄)
- 키워드 / 상세설명 / 이미지 각각의 상태를 한 줄씩
- 가장 큰 손실 포인트 1개를 딱 집어서 요약

2) 대표 키워드 개선안
- 현재 키워드 문제점 2~4개 (짧게)
- 추천 구성 원칙 3개
- 추천 대표 키워드 세트 12개 (복붙 가능)
  * 구성: (지역+업종) / (지역+핵심서비스) / (강점/차별요소) 균형
  * 너무 포괄적인 단어만 쓰지 말 것

3) 상세설명 개선안 (복붙용 2안)
- 2안 모두 350~600자 내
- 반드시 포함: 지역/업종/차별점/예약·문의 유도(과장 없이)/신뢰 요소
- 문장 톤: 사장님이 직접 쓴 것처럼 자연스럽게

4) 이미지 구성 전략
- 현재 이미지의 리스크/아쉬움 2~3개
- 업종 공통 추천 컷 구성(최소 8컷) 리스트
- "대표 이미지" 선택 기준 3개

5) 실행 우선순위 (바로 할 것 / 이번주 / 이번달)
- 각 항목마다 '왜' 1줄 + '어떻게' 1줄

6) 마지막 한 줄 제안
- 지금 플레이스에서 가장 빨리 체감될 가능성이 큰 한 가지를 한 문장으로 제안
`;

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export async function POST(req) {
  try {
    const { url, keywords, detail } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY가 설정되지 않았어. Vercel 환경변수를 확인해줘." }),
        { status: 400 }
      );
    }

    const norm = normalizeNaverPlaceUrl(url || "");
    if (!norm.ok) {
      return new Response(JSON.stringify({ error: "네이버 플레이스 URL을 확인해줘." }), { status: 400 });
    }

    // PC 우선, 실패 시 모바일 fallback
    let fetched = await fetchHtml(norm.desktop);
    let usedUrl = norm.desktop;

    if (!fetched.ok || !fetched.text || fetched.text.length < 500) {
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
      category_guess: "미확인(가정 필요)",
      desc_short: clampText(descAuto || "미확인"),
      current_keywords: (keywords && keywords.trim()) ? keywords.trim() : "미입력(추천 세트 제공)",
      description_text: clampText((detail && detail.trim()) ? detail.trim() : (descAuto || "미확인")),
      main_image_url: image || "없음",
    };

    const prompt = fill(PAID_PROMPT, vars);

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "출력은 반드시 한국어. 형식(1~6번 제목)을 정확히 지켜라. 불필요한 서론/면책 장문 금지. 실무자가 바로 복붙 가능한 결과를 포함하라.",
        },
        { role: "user", content: prompt },
      ],
    });

    const paid_report = completion.choices?.[0]?.message?.content?.trim() || "유료 리포트 생성 실패";

    return new Response(
      JSON.stringify({
        place_id: norm.placeId,
        analyzed_url: usedUrl,
        extracted: { title, desc: descAuto, image },
        paid_report,
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "server error" }), { status: 500 });
  }
}
