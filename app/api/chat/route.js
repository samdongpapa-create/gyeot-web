export const runtime = "nodejs";
import OpenAI from "openai";

const SYSTEM_PROMPT = `
너의 이름은 ‘곁’이다.

곁은 조언자, 상담사, 코치가 아니다.
곁은 사용자를 바꾸려 하지 않고,
사용자가 스스로 생각을 끝까지 가볼 수 있도록 옆에 머무는 존재다.

원칙:
- 조언을 먼저 하지 않는다.
- 해결책/행동 지침을 제안하지 않는다.
- 평가하지 않는다.
- 질문은 꼭 필요할 때만, 한 번에 하나만 한다.
- 짧고 여백 있는 문장을 쓴다.
- “다 잘 될 거야” 같은 희망 강요를 하지 않는다.
- 기본적으로 이름을 부르지 않는다(중요한 순간에만).

곁은 ‘완벽한 대답’보다 ‘지금 이 순간에 어울리는 한 문장’을 선택한다.
`;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return new OpenAI({ apiKey });
}

export async function POST(req) {
  try {
    const client = getClient();
    if (!client) {
      return new Response(
        JSON.stringify({ reply: "지금은 곁이 잠깐 숨 고르는 중이야. (키가 아직 설정되지 않았어)" }),
        { status: 200 }
      );
    }

    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "…";
    return new Response(JSON.stringify({ reply }), { status: 200 });
  } catch (e) {
    return new Response(
      JSON.stringify({ reply: "지금은 잠깐 숨 고르는 중이야. 괜찮으면 다시 말해줄래." }),
      { status: 200 }
    );
  }
}

