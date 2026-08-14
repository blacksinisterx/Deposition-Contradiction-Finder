import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const GROQ_MODEL = "openai/gpt-oss-120b";

export async function POST(req: NextRequest, { params }: { params: Promise<{ contradictionId: string }> }) {
  const { contradictionId } = await params;
  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const { data: contradiction, error: contradictionError } = await supabaseAdmin
    .from("contradictions")
    .select(
      "status, severity, reasoning, claim_a:claims!claim_a_id(witness_name, page, line, claim_text), claim_b:claims!claim_b_id(witness_name, page, line, claim_text)",
    )
    .eq("id", contradictionId)
    .single();
  if (contradictionError || !contradiction) {
    return NextResponse.json({ error: "contradiction not found" }, { status: 404 });
  }

  const { data: history } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("contradiction_id", contradictionId)
    .order("created_at", { ascending: true });

  const { data: userMessage, error: userMsgError } = await supabaseAdmin
    .from("messages")
    .insert({ contradiction_id: contradictionId, role: "user", content: content.trim() })
    .select()
    .single();
  if (userMsgError) {
    return NextResponse.json({ error: userMsgError.message }, { status: 500 });
  }

  const claimA = contradiction.claim_a as unknown as { witness_name: string; page: number; line: number; claim_text: string };
  const claimB = contradiction.claim_b as unknown as { witness_name: string; page: number; line: number; claim_text: string };

  const systemPrompt = `You are a litigation analyst explaining one flagged contradiction between two deposition statements to an attorney.

Verdict: ${contradiction.status} (severity: ${contradiction.severity})

Statement A -- ${claimA.witness_name}, p.${claimA.page}:${claimA.line}:
"${claimA.claim_text}"

Statement B -- ${claimB.witness_name}, p.${claimB.page}:${claimB.line}:
"${claimB.claim_text}"

Reasoning for the verdict:
${contradiction.reasoning}

Answer the attorney's questions about this contradiction directly and concisely. Ground every answer in the two statements and the reasoning above -- don't invent details they don't support. Reply in plain prose, no markdown formatting (no tables, bullet lists, or asterisk-bolding) -- this renders as plain text.`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: content.trim() },
      ],
    }),
  });

  if (!groqRes.ok) {
    const detail = await groqRes.text();
    return NextResponse.json({ error: `LLM request failed: ${detail}`, userMessage }, { status: 502 });
  }

  const groqBody = await groqRes.json();
  const replyText = groqBody.choices?.[0]?.message?.content ?? "(no response)";

  const { data: assistantMessage, error: assistantMsgError } = await supabaseAdmin
    .from("messages")
    .insert({ contradiction_id: contradictionId, role: "assistant", content: replyText })
    .select()
    .single();
  if (assistantMsgError) {
    return NextResponse.json({ error: assistantMsgError.message, userMessage }, { status: 500 });
  }

  return NextResponse.json({ userMessage, assistantMessage }, { status: 201 });
}
