import { NextResponse } from "next/server";

import OpenAI from "openai";

import { createClient } from "@/lib/server";

type EventDocumentRow = {
  id: string;
  body: string;
};

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ seeded: 0, error: "OPENAI_API_KEY is not configured." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: documents, error } = await supabase
      .from("event_documents")
      .select("id, body")
      .is("embedding", null)
      .limit(100);

    if (error) {
      return NextResponse.json({ seeded: 0, error: error.message }, { status: 500 });
    }

    if (!documents?.length) {
      return NextResponse.json({ seeded: 0, message: "No unembedded event documents found." });
    }

    const rows = documents as EventDocumentRow[];
    const openai = new OpenAI({ apiKey });
    const embeddings = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: rows.map((row) => row.body),
    });

    const results = await Promise.all(
      rows.map((row, index) =>
        supabase.from("event_documents").update({ embedding: embeddings.data[index].embedding }).eq("id", row.id),
      ),
    );
    const failed = results.filter((result) => result.error);

    return NextResponse.json({
      seeded: rows.length - failed.length,
      failed: failed.length,
      errors: failed.map((result) => result.error?.message).filter(Boolean),
    });
  } catch (error) {
    return NextResponse.json(
      { seeded: 0, error: error instanceof Error ? error.message : "Embedding seed failed." },
      { status: 500 },
    );
  }
}
