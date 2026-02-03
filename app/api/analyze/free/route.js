export const runtime = "nodejs";
export const preferredRegion = ["icn1"];

import OpenAI from "openai";

/* ---------------- URL 정규화 ---------------- */
function normalizeNaverPlaceUrl(input) {
  let u;
  try {
    u = new URL((input || "").trim());
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

/* ---------------- fetch (안전/타임아웃) ---------------- */
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
    "Referer": "https://m.place.naver.com/",
  };

  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
    const text = await res.text();
    clearTimeout(timeout);
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, status: 0, text: "" };
  }
}

/* ---------------- HTML 파서 유틸 ---------------- */
function pickMeta(html, attr, key) {
  // attr: property or name
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${escapeRegExp(key)}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  return html.match(re)?.[1] || "";
}
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function stripTags(s) {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function uniq(arr) {
  const out = [];
  const set = new Set();
  for (const v of arr || []) {
    const t = String(v || "").trim();
    if (!t) continue;
    if (set.has(t)) continue;
    set.add(t);
    out.push(t);
  }
  return out;
}

/* ---------------- JSON-LD 추출 ---------------- */
function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1])
    .filter(Boolean);

  const parsed = [];
  for (const b of blocks) {
    try {
      parsed.push(JSON.parse(b.trim()));
    } catch {}
  }
  return parsed;
}

/* ---------------- __NEXT_DATA__ 추출 ---------------- */
function extractNextData(html) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/* ---------------- 딥서치(유사 구조 대응) ---------------- */
function deepCollect(node, predicate, limit = 50) {
  const out = [];
  const seen = new Set();

  function walk(x) {
    if (!x || out.length >= limit) return;
    if (typeof x !== "object") return;

    if (Array.isArray(x)) {
      for (const v of x) walk(v);
      return;
    }

    for (const [k, v] of Object.entries(x)) {
      try {
        const got = predicate(k, v);
        if (got) {
          const vals = Array.isArray(got) ? got : [got];
          for (const val of vals) {
            const t = String(val || "").trim();
            if (!t) continue;
            if (seen.has(t)) continue;
            seen.add(t);
            out.push(t);
            if (out.length >= limit) return;
          }
        }
      } catch {}

      walk(v);
      if (out.length >= limit) return;
    }
  }

  walk(node);
  return out;
}

function guessKeywordsFromData(nextData, html) {
  const metaKeywords = pickMeta(html, "name", "keywords");
  const metaList = metaKeywords ? metaKeywords.split(",").map(s => s.trim()) : [];

  const nextList = nextData
    ? deepCollect(nextData, (k, v) => {
        const kk = k.toLowerCase();
        if (["keywords", "keyword", "tags", "tag", "hashtags", "hashtag"].includes(kk)) {
          if (typeof v === "string") return v.split(",").map(s => s.trim());
          if (Array.isArray(v)) return v.map(x => (typeof x === "string" ? x : x?.name || x?.text)).filter(Boolean);
        }
        return null;
      }, 40)
    : [];

  return uniq([...metaList, ...nextList]).slice(0, 20);
}

function guessDescription(nextData, jsonlds, html) {
  const ogDesc = stripTags(pickMeta(html, "property", "og:description"));
  const ldDesc = (jsonlds || [])
    .map(x => x?.description)
    .filter(Boolean)
    .map(stripTags)[0] || "";

  const nextDesc = nextData
    ? (deepCollect(nextData, (k, v) => {
        const kk = k.toLowerCase();
        if (["description", "introduce", "introduction", "summary", "content"].includes(kk) && typeof v === "string") {
          return stripTags(v);
        }
        return null;
      }, 10)[0] || "")
    : "";

  // 길이/품질 우선순위: next > ld > og
  return (nextDesc || ldDesc || ogDesc || "").trim();
}

function guessName(jsonlds, html) {
  const ogTitle = stripTags(pickMeta(html, "property", "og:title"));
  const ldName = (jsonlds || []).map(x => x?.name).filter(Boolean)[0] || "";
  return (ogTitle || ldName || "").trim();
}

function guessMainImage(jsonlds, html) {
  const ogImg = pickMeta(html, "property", "og:image");
  const ldImg = (jsonlds || [])
    .map(x => x?.image)
    .flat()
    .find(v => typeof v === "string" && v.startsWith("http")) || "";
  return (ogImg || ldImg || "").trim();
}

/* ---------------- FREE 프롬프트 ---------------- */
const FREE_PROMPT = `
너는 네이버 플레이스 로컬 SEO를 분석하는 전문가다.
아래 정보를 바탕으로 사장님이 이해하기 쉬운 말로 "가장 큰 손실 포인트 1개"만 짚어라.

규칙
- 노출/순위 보장 금지
- 해결책 여러개 금지 (딱 1개)
- 짧고 명확

입력
- 플레이스명: {{name}}
- 대표 키워드(추출): {{keywords}}
- 상세설명(추출): {{description}}
- 대표 이미지: {{hasImage}}

출력 형식
1. 한 줄 요약
2. 가장 아쉬운 포인트 1가지
3. 지금 바로 수정하면 좋은 포인트 1개
`;

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

/* ---------------- API ---------------- */
export async function POST(req) {
  try {
    const { url } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY가 설정되지 않았어." }), { status: 400 });
    }

    const norm = normalizeNaverPlaceUrl(url);
    if (!norm.ok) {
      return new Response(JSON.stringify({ error: "네이버 플레이스 URL을 확인해줘." }), { status: 400 });
    }

    // 모바일이 __NEXT_DATA__를 포함할 확률이 더 높아서 mobile 먼저 시도
    let fetched = await fetchHtml(norm.mobile);
    let usedUrl = norm.mobile;

    if (!fetched.ok || !fetched.text || fetched.text.length < 500) {
      const f2 = await fetchHtml(norm.desktop);
      if (f2.ok) {
        fetched = f2;
        usedUrl = norm.desktop;
      }
    }

    if (!fetched.ok || !fetched.text) {
      // ✅ fetch 실패여도 JSON으로 “정상 응답” (프론트가 안 죽게)
      return new Response(
        JSON.stringify({
          place_id: norm.placeId,
          analyzed_url: usedUrl,
          fetch_failed: true,
          extracted: { name: "", keywords: [], description: "", mainImage: "" },
          free_report:
            "네이버 페이지를 서버에서 가져오지 못했어(fetch failed).\n\n가능한 원인:\n- 네이버가 서버/해외 IP 요청을 차단\n- Vercel 함수 리전이 한국이 아님\n\n조치:\n1) vercel.json(icn1) 적용 후 재배포\n2) 그래도 안 되면 '한국 egress 서버(프록시)'가 필요할 수 있어.",
        }),
        { status: 200 }
      );
    }

    const html = fetched.text;
    const jsonlds = extractJsonLd(html);
    const nextData = extractNextData(html);

    const name = guessName(jsonlds, html) || "알 수 없음";
    const keywords = guessKeywordsFromData(nextData, html);
    const description = guessDescription(nextData, jsonlds, html);
    const mainImage = guessMainImage(jsonlds, html);

    const prompt = fill(FREE_PROMPT, {
      name,
      keywords: keywords.join(", ") || "없음",
      description: description || "없음",
      hasImage: mainImage ? "있음" : "없음",
    });

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.35,
      messages: [
        { role: "system", content: "출력은 한국어. 형식을 지켜라. 짧게." },
        { role: "user", content: prompt },
      ],
    });

    const free_report = completion.choices?.[0]?.message?.content?.trim() || "리포트 생성 실패";

    return new Response(
      JSON.stringify({
        place_id: norm.placeId,
        analyzed_url: usedUrl,
        fetch_failed: false,
        extracted: {
          name,
          keywords,
          description,
          mainImage,
        },
        free_report,
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "server error" }), { status: 500 });
  }
}
