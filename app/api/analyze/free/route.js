export const runtime = "nodejs";

import OpenAI from "openai";

function pickMeta(html, property) {
  // <meta property="og:title" content="...">
  const re = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const m = html.match(re);
  return m?.[1]?.trim() || "";
}

function pickTitle(html) {
  const m = html.match(/<title>(.*?)<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ")?.trim() || "";
}

function stripTags(s) {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      // 네이버가 기본 UA로 막는 경우가 있어 UA를 넣어줌
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

const FREE_PROMPT = `
너는 네이버 플레이스 로컬 SEO를 분석하는 전문가다.
아래 플레이스 정보를 바탕으로,
사장님이 바로 이해할 수 있는 말로
현재 상태를 요약하고,
가장 큰 손실 포인트 1가지를 짚어라.

⚠️ 주의사항:
- 순위 보장, 알고리즘 단정 표현 금지
- 전략을 여러 개 제시하지 말 것
- 지금 당장 고칠 수 있는 포인트 1개만 제시
- 친절하지만 전문가 톤 유지

[입력 정보]
- 플레이스명: {{place_name}}
- 업종/카테고리: {{category}}
- 지역: {{location}}
- 현재 대표 키워드: {{current_keywords}}
- 상세 설명 텍스트: {{description_text}}
- 이미지 정보:
  - 전체 이미지 수: {{image_count}}
  - 대표 이미지 존재 여부: {{has_main_image}}
  - 이미지 유형: {{image_types}}
  - 이미지 설명 텍스트 존재 여부: {{has_image_text}}

[출력 형식]
1. 한 줄 요약
2. 가장 아쉬운 포인트 1가지
3. 지금 바로 수정하면 좋은 포인트 1개
`;

function fillTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? "").toString());
}

export async function POST(req) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url이 필요해." }), { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY가 설정되지 않았어. Vercel 환경변수를 확인해줘." }),
        { status: 400 }
      );
    }

    // 1) HTML 가져오기
    const fetched = await fetchHtml(url.trim());
    if (!fetched.ok) {
      // 네이버/차단 등으로 실패할 수 있음
      return new Response(
        JSON.stringify({
          extracted: {},
          free_report:
            "플레이스 페이지 정보를 가져오지 못했어.\n- 주소가 정확한지 확인해줘.\n- 또는 다음 단계에서 (대표키워드/상세설명/이미지) 일부를 직접 붙여넣는 방식으로 분석 정확도를 올릴 수 있어.",
          fetch_status: fetched.status,
        }),
        { status: 200 }
      );
    }

    const html = fetched.text;

    // 2) 최소 정보 추출(가능한 범위)
    const ogTitle = pickMeta(html, "og:title");
    const ogDesc = pickMeta(html, "og:description");
    const ogImage = pickMeta(html, "og:image");
    const title = ogTitle || pickTitle(html);
    const desc = stripTags(ogDesc);

    // MVP: 대표키워드/카테고리/지역은 1차는 비워두고,
    // 다음 단계에서 추출 고도화하거나 사용자 입력을 받도록 확장한다.
    const vars = {
      place_name: title || "알 수 없음",
      category: "미확인(추출 예정)",
      location: "미확인(추출 예정)",
      current_keywords: "미확인(추출 예정)",
      description_text: desc || "미확인(추출 예정)",
      image_count: ogImage ? "1+" : "0",
      has_main_image: ogImage ? "예" : "아니오",
      image_types: ogImage ? "대표 이미지(OG)" : "미확인",
      has_image_text: "미확인(추출 예정)",
    };

    const prompt = fillTemplate(FREE_PROMPT, vars);

    // 3) OpenAI로 FREE 리포트 생성
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "출력은 한국어로, 간결하게. 형식을 지켜라." },
        { role: "user", content: prompt },
      ],
    });

    const free_report = completion.choices?.[0]?.message?.content?.trim() || "리포트 생성 실패";

    return new Response(
      JSON.stringify({
        extracted: { title, desc, image: ogImage },
        free_report,
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "server error" }), { status: 500 });
  }
}
