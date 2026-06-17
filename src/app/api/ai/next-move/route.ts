import { NextResponse } from "next/server";

import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  profile: z.object({
    name: z.string(),
    project: z.string(),
    goals: z.array(z.string()),
    stack: z.array(z.string()),
    skillGaps: z.array(z.string()),
    priority: z.string(),
  }),
  day: z.string(),
  selectedTime: z.string(),
  best: z.object({
    title: z.string(),
    time: z.string(),
    endTime: z.string(),
    venue: z.string(),
    outcome: z.string(),
    tags: z.array(z.string()),
  }),
  next: z
    .object({
      title: z.string(),
      time: z.string(),
      endTime: z.string(),
      venue: z.string(),
    })
    .optional(),
  deadlineTitle: z.string().optional(),
  retrievalContext: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
        sourceType: z.string(),
        similarity: z.number(),
      }),
    )
    .default([]),
  deterministicExplanation: z.string(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const fallback = fallbackInsight(parsed.data);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ source: "deterministic", ...fallback });
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are AABW Next Move, a concise live-event Builder Experience copilot. Your job is to help Agentic AI Build Week builders act faster, cut confusion, and get more out of the week in real time. Use retrieved event context when present. Keep time, venue, deadline, mentor, perk, and support constraints concrete. Do not behave like a generic chatbot; return workflow-ready next actions. Return only JSON with explanation, now, next, beforeDemo, risk.",
        },
        {
          role: "user",
          content: JSON.stringify(parsed.data),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "next_move_insight",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["explanation", "now", "next", "beforeDemo", "risk"],
            properties: {
              explanation: { type: "string" },
              now: { type: "string" },
              next: { type: "string" },
              beforeDemo: { type: "string" },
              risk: { type: "string" },
            },
          },
          strict: true,
        },
      },
    });

    const text = response.output_text;
    const insight = JSON.parse(text) as ReturnType<typeof fallbackInsight>;
    return NextResponse.json({ source: "openai", ...insight });
  } catch (error) {
    return NextResponse.json({
      source: "deterministic",
      ...fallback,
      reason: error instanceof Error ? error.message : "OpenAI request failed",
    });
  }
}

function fallbackInsight(data: z.infer<typeof requestSchema>) {
  return {
    explanation: data.deterministicExplanation,
    now: `Go to ${data.best.title} at ${data.best.venue}.`,
    next: data.next ? `Afterward, consider ${data.next.title}.` : "Afterward, capture notes and update your README.",
    beforeDemo: data.deadlineTitle
      ? `Do not miss: ${data.deadlineTitle}.`
      : "Keep a fallback demo video and seeded data ready.",
    risk: "Rule-based fallback is active; verify the venue, deadline, and support channel before moving.",
  };
}
