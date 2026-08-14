import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const GITHUB_REPO = "blacksinisterx/Deposition-Contradiction-Finder";
const GITHUB_REF = "main";

type IncomingDocument = {
  witnessName: string;
  depositionDate: string | null;
  storagePath: string;
};

export async function POST(req: NextRequest) {
  const { caseName, documents } = (await req.json()) as {
    caseName?: string;
    documents?: IncomingDocument[];
  };

  if (!caseName || !documents || documents.length === 0) {
    return NextResponse.json({ error: "caseName and at least one document are required" }, { status: 400 });
  }

  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from("cases")
    .insert({ name: caseName })
    .select("id")
    .single();
  if (caseError) {
    return NextResponse.json({ error: caseError.message }, { status: 500 });
  }

  const { data: documentRows, error: documentsError } = await supabaseAdmin
    .from("documents")
    .insert(
      documents.map((d) => ({
        case_id: caseRow.id,
        witness_name: d.witnessName,
        deposition_date: d.depositionDate,
        storage_path: d.storagePath,
      })),
    )
    .select("id, witness_name, storage_path");
  if (documentsError) {
    return NextResponse.json({ error: documentsError.message }, { status: 500 });
  }

  const { data: analysis, error: analysisError } = await supabaseAdmin
    .from("analyses")
    .insert({ case_id: caseRow.id, status: "pending" })
    .select("id")
    .single();
  if (analysisError) {
    return NextResponse.json({ error: analysisError.message }, { status: 500 });
  }

  const documentsJson = JSON.stringify(
    documentRows.map((d) => ({
      document_id: d.id,
      witness_name: d.witness_name,
      storage_path: d.storage_path,
    })),
  );

  const dispatch = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/analyze.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: GITHUB_REF,
        inputs: { case_id: caseRow.id, analysis_id: analysis.id, documents_json: documentsJson },
      }),
    },
  );

  if (!dispatch.ok) {
    const detail = await dispatch.text();
    await supabaseAdmin.from("analyses").update({ status: "failed" }).eq("id", analysis.id);
    return NextResponse.json({ error: `GitHub Actions dispatch failed: ${detail}` }, { status: 502 });
  }

  return NextResponse.json({ caseId: caseRow.id, analysisId: analysis.id }, { status: 201 });
}
