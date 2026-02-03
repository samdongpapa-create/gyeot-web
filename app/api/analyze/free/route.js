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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": "https://m.place.naver.com/"
  };

  try {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });
    const text = await res.text();
    clearTimeout(timeout);
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, status: 0, text: "" };
  }
}

    redirect: "follow",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

/* ---------- helpers ---------- */
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

/* ---------- __NEXT_DATA__ 추출 ---------- */
function extractNextData(html) {
  const m = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// 객체 전체를 훑어서 특정 키 후보를 찾아내는 “휴리스틱”
function deepFindStrings(obj, keyCandidates = [], limit = 20) {
  const out = [];
  const seen = new Set();

  function walk(node) {
    if (!node || out.length >= limit) return;
    if (typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }

    for (const [k, v] of Object.entries(node)) {
      const kk = k.toLowerCase();

      // 키워드 후보 키면 string/array 뽑기
      if (keyCandidates.includes(kk)) {
        if (typeof v === "string") {
          const val = v.trim();
          if (val && !seen.has(val)) {
            seen.add(val);
            out.push(val);
          }
        } else if (Array.isArray(v)) {
          for (const it of v) {
            if (typeof it === "string") {
              const val = it.trim();
              if (val && !seen.has(val)) {
                seen.add(val);
                out.push(val);
              }
            } else if (it && typeof it === "object") {
              // {name:""} 형태도 대응
              const name = it.name || it.keyword || it.text;
              if (typeof name === "string") {
                const val = name.trim();
                if (val && !seen.has(val)) {
                  seen.add(val);
                  out.push(val);
                }
              }
            }
          }
        } else if (v && typeof v === "object") {
          const name = v.name || v.keyword || v.text;
          if (typeof name === "string") {
            const val = name.trim();
            if (val && !seen.has(val)) {
              seen.add(val);
              out.push(val);
            }
          }
        }
      }

      walk(v);
    }
  }

  walk(obj);
  return out;
}

function deepFindFirstString(obj, keyCandidates = []) {
  let found = "";
  function walk(node) {
    if (!node || found) return;
    if (typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }

    for (const [k, v] of Object.entries(node)) {
      const kk = k.toLowerCase();
      if (keyCandidates.includes(kk) && typeof v === "string") {
        const val = v.trim();
        if (val) {
          found = val;
          return;
        }
      }
      walk(v);
      if (found) return;
    }
  }
  walk(obj);
  return found;
}

const FREE_PROMPT = `
너는 네이버 플레이스 로컬 SEO를 분석하는 전문가다.
아래 플레이스 정보를 바탕으로,
사장님이 이해하기 쉬운 말로 "가장 큰 손실 포인트 1개"만 짚어라.

⚠️ 규칙
- 순위/노출 보장 금지
- 해결책 여러 개 금지(딱 1개)
- 짧고 명확하게

[입력 정보]
- 플레이스명: {{place_name}}
- 현재 대표 키워드: {{current_keywords}}
- 상세 설명 텍스트: {{description_text}}
- 이미지 정보:
  - 대표 이미지 여부: {{has_main_image}}
  - 대표 이미지 URL: {{main_image_url}}

[출력 형식]
1. 한 줄 요약
2. 가장 아쉬운 포인트 1가지
3. 지금 바로 수정하면 좋은 포인트 1개
`;

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export async function POST(req) {
  try {
    const { url, keywords, detail } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY가 비어있어." }), { status: 400 });
    }

    const norm = normalizeNaverPlaceUrl(url || "");
    if (!norm.ok) {
      return new Response(JSON.stringify({ error: "네이버 플레이스 URL을 확인해줘." }), { status: 400 });
    }

    // PC → 모바일 fallback
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

    // OG 메타(항상 보험)
    const ogTitle = pickMeta(html, "og:title");
    const ogDesc = stripTags(pickMeta(html, "og:description"));
    const ogImage = pickMeta(html, "og:image");

    // 모바일 Next.js 데이터에서 추가 추출 시도
    const nextData = extractNextData(html);

    // 상세설명 후보 키들 (네이버 구조 바뀌어도 최대한 잡는 용도)
    const descFromNext =
      nextData
        ? deepFindFirstString(nextData, ["description", "introduce", "introduction", "summary", "content"])
        : "";

    // 대표키워드 후보(태그/키워드)
    const kwsFromNext =
      nextData
        ? deepFindStrings(nextData, ["keywords", "keyword", "tag", "tags", "hash", "hashtags"], 20)
        : [];

    // 대표 이미지 후보(이미지 URL이 여러 곳에 있을 수 있어 배열로 탐색)
    const imgCandidates =
      nextData
        ? deepFindStrings(nextData, ["image", "images", "thumbnail", "thumbnails", "photo", "photos", "url"], 30)
        : [];
    const firstImageFromNext = imgCandidates.find(v => typeof v === "string" && v.startsWith("http")) || "";

    const title = ogTitle || "알 수 없음";

    // 사용자 입력이 있으면 우선, 없으면 자동 추출 사용
    const finalDetail =
      (detail && detail.trim()) ||
      descFromNext ||
      ogDesc ||
      "미확인";

    const finalKeywords =
      (keywords && keywords.trim()) ||
      (kwsFromNext.length ? kwsFromNext.slice(0, 12).join(", ") : "") ||
      "미확인";

    const mainImageUrl = ogImage || firstImageFromNext || "";

    const vars = {
      place_name: title,
      current_keywords: finalKeywords,
      description_text: finalDetail,
      has_main_image: mainImageUrl ? "예" : "아니오",
      main_image_url: mainImageUrl || "없음",
    };

    const prompt = fill(FREE_PROMPT, vars);

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "출력은 한국어. 형식(1~3)을 지켜라. 짧게." },
        { role: "user", content: prompt },
      ],
    });

    const free_report = completion.choices?.[0]?.message?.content?.trim() || "리포트 생성 실패";

    return new Response(
      JSON.stringify({
        place_id: norm.placeId,
        analyzed_url: usedUrl,
        extracted: {
          title,
          desc: ogDesc || descFromNext || "",
          image: mainImageUrl,
          auto_keywords: kwsFromNext.slice(0, 20), // 디버깅용(화면에 안 보여도 됨)
        },
        free_report,
      }),
      { status: 200 }
    );
  } catch (e) {
    // ✅ 어떤 에러가 나도 JSON으로 반환 (프론트 파싱 깨짐 방지)
    return new Response(JSON.stringify({ error: e?.message || "server error" }), { status: 500 });
  }
}

