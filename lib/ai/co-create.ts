import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type DocKind = "resume-a" | "cv-a" | "resume-b" | "cv-b" | "general";

// What the AI can edit. Frontend renders a diff card for these targets.
//   summary             →  Resume parsed.summary (A) OR ResumeTailor.summary.after (B)
//   bullet:<eIdx>:<bIdx>→  Resume parsed.experience[eIdx].bullets[bIdx]   (A only)
//   bullet:<idx>        →  ResumeTailor.bullets[idx].after                (B only)
//   content             →  CoverLetter.content (A) OR CoverLetterTailor.content (B)
export type EditTarget = string;

export interface DocSnapshot {
  kind:     DocKind;
  jobTitle?: string;
  company?:  string;
  // Pre-formatted snapshot the AI will read; one canonical layout per docKind
  text:     string;
}

export interface ChatTurn {
  role:    "user" | "assistant";
  content: string;
}

export interface AiCoCreateReply {
  reply:    string;                 // free-form chat text shown to the user
  proposal: {
    target:  EditTarget;
    before:  string;
    after:   string;
    note?:   string;
  } | null;
}

// Build the system prompt: it MUST tell the model what edit targets are valid
// for the current doc kind so its proposal.target string can be applied.
function systemPrompt(snap: DocSnapshot): string {
  const allowed = (() => {
    switch (snap.kind) {
      case "resume-a": return [
        '"summary" — top-of-resume professional summary',
        '"bullet:<expIdx>:<bulletIdx>" — a specific work-experience bullet',
      ];
      case "cv-a":     return ['"content" — the entire cover letter body'];
      case "resume-b": return [
        '"summary" — tailored summary (writes to summary.after)',
        '"bullet:<idx>" — tailored bullet at index N (writes to bullets[N].after)',
      ];
      case "cv-b":     return ['"content" — tailored cover letter body'];
      default:         return [];
    }
  })();

  return `You are an expert resume coach helping the user co-create their job application materials. You speak Traditional Chinese (zh-TW) by default unless the user writes in another language.

CURRENT DOCUMENT CONTEXT:
- Kind: ${snap.kind}${snap.company ? ` (target: ${snap.company} – ${snap.jobTitle})` : ""}

DOCUMENT SNAPSHOT:
"""
${snap.text}
"""

RESPONSE FORMAT — strict JSON, no prose outside the JSON, no markdown fencing:
{
  "reply":    "<your conversational reply, zh-TW unless user wrote otherwise>",
  "proposal": null  // or an edit object (see below) when you want to propose a concrete change
}

When the user explicitly asks for an edit OR you have a clear improvement to propose, set "proposal" to:
{
  "target":   <one of: ${allowed.join(", ") || '"none"'}>,
  "before":   "<the EXACT current text in the snapshot you want to replace>",
  "after":    "<your improved version>",
  "note":     "<optional one-line zh-TW note explaining the change>"
}

Rules:
- ONLY use facts present in the snapshot or volunteered by the user. NEVER invent experience, employers, dates, or numbers.
- "before" must match a substring of the snapshot exactly (so we can locate it). If unsure, ask a clarifying question and set proposal=null.
- Make ONE proposal per turn; if multiple changes are needed, suggest the most impactful one and offer follow-ups in "reply".
- If the user is just chatting (asking advice, brainstorming), keep proposal=null.
- Output JSON only — no preamble, no code fences.`;
}

// Use Haiku for general chat dialogue. The model is also asked to generate
// proposals; this is fine in practice — Haiku 4.5 handles structured edits well.
// We could split (Sonnet only for proposals) later if needed.
export async function coCreateReply(
  snap: DocSnapshot,
  history: ChatTurn[],
  userMessage: string,
): Promise<AiCoCreateReply> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      reply:    "（AI 服務暫時無法使用，請稍後再試）",
      proposal: null,
    };
  }

  const messages = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: userMessage },
  ];

  const msg = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system:     systemPrompt(snap),
    messages,
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  // Defensive parse — strip any leading/trailing junk.
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  if (start < 0 || end < 0) {
    return { reply: raw.trim() || "我這邊沒收到完整回覆，可以再說一次嗎？", proposal: null };
  }
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const proposal = parsed?.proposal ?? null;
    return {
      reply:    typeof parsed.reply === "string" ? parsed.reply : "",
      proposal: proposal && typeof proposal.target === "string" && typeof proposal.before === "string" && typeof proposal.after === "string"
        ? {
            target: proposal.target,
            before: proposal.before,
            after:  proposal.after,
            note:   typeof proposal.note === "string" ? proposal.note : undefined,
          }
        : null,
    };
  } catch {
    return { reply: raw.trim(), proposal: null };
  }
}
