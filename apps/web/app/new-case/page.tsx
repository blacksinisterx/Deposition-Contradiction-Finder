"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { FileText, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type DocumentRow = {
  id: string;
  file: File;
  witnessName: string;
  depositionDate: string;
};

function pickFiles(fileList: FileList): { accepted: File[]; rejected: string[] } {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const f of Array.from(fileList)) {
    if (!f.name.endsWith(".txt")) {
      rejected.push(`${f.name} (must be .txt)`);
    } else if (f.size > MAX_FILE_BYTES) {
      rejected.push(`${f.name} (exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB)`);
    } else {
      accepted.push(f);
    }
  }
  return { accepted, rejected };
}

export default function NewCasePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [caseName, setCaseName] = useState("");
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [stage, setStage] = useState<"idle" | "uploading" | "starting">("idle");

  const busy = stage !== "idle";

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const { accepted, rejected } = pickFiles(fileList);
    rejected.forEach((r) => toast.error(`Skipped ${r}`));
    if (accepted.length === 0) return;
    setRows((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        witnessName: file.name.replace(/\.txt$/, "").replace(/[-_]/g, " "),
        depositionDate: "",
      })),
    ]);
  }

  function updateRow(id: string, patch: Partial<DocumentRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function startAnalysis() {
    if (!caseName.trim()) return toast.error("Case name is required");
    if (rows.length === 0) return toast.error("Add at least one deposition transcript");
    const missingWitness = rows.find((r) => !r.witnessName.trim());
    if (missingWitness) return toast.error("Every deposition needs a witness name");

    setStage("uploading");
    const uploaded: { witnessName: string; depositionDate: string | null; storagePath: string }[] = [];
    for (const row of rows) {
      const storagePath = `${crypto.randomUUID()}/${row.file.name}`;
      const { error } = await supabase.storage
        .from("deposition-uploads")
        .upload(storagePath, row.file, { contentType: "text/plain" });
      if (error) {
        toast.error(`Upload failed for ${row.file.name}: ${error.message}`);
        setStage("idle");
        return;
      }
      uploaded.push({
        witnessName: row.witnessName.trim(),
        depositionDate: row.depositionDate || null,
        storagePath,
      });
    }

    setStage("starting");
    const res = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseName: caseName.trim(), documents: uploaded }),
    });
    const body = await res.json();

    if (!res.ok) {
      toast.error(`Could not start analysis: ${body.error ?? res.statusText}`);
      setStage("idle");
      return;
    }

    router.push(`/cases/${body.caseId}/analyses/${body.analysisId}`);
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl"
      >
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">New Case</CardTitle>
            <CardDescription>
              Upload witness depositions from the same case. The agent builds a timeline for each
              witness and flags contradictions with exact page/line citations.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-(--space-lg)">
            <div className="flex flex-col gap-(--space-sm)">
              <Label htmlFor="case-name">Case name</Label>
              <Input
                id="case-name"
                value={caseName}
                onChange={(e) => setCaseName(e.target.value)}
                placeholder="Martinez v. Coastal Freight Co."
                disabled={busy}
              />
            </div>

            <div className="flex flex-col gap-(--space-sm)">
              <Label>Deposition transcripts (.txt, max 5 MB each)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                multiple
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <motion.button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                whileHover={busy ? undefined : { scale: 1.005 }}
                whileTap={busy ? undefined : { scale: 0.995 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex cursor-pointer items-center justify-center gap-(--space-sm) rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="size-4" />
                Add deposition files
              </motion.button>
            </div>

            {rows.length > 0 && (
              <div className="flex flex-col gap-(--space-sm)">
                <AnimatePresence initial={false}>
                  {rows.map((row, i) => (
                    <motion.div
                      key={row.id}
                      initial={{ opacity: 0, scale: 0.96, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-col gap-(--space-sm) rounded-lg border border-border bg-background p-(--space-md) shadow-(--shadow-sm) sm:flex-row sm:items-end"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-(--space-sm) sm:pb-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm text-foreground" title={row.file.name}>
                          {row.file.name}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 sm:w-48">
                        <Label htmlFor={`witness-${row.id}`} className="text-xs text-muted-foreground">
                          Witness name
                        </Label>
                        <Input
                          id={`witness-${row.id}`}
                          value={row.witnessName}
                          onChange={(e) => updateRow(row.id, { witnessName: e.target.value })}
                          disabled={busy}
                        />
                      </div>
                      <div className="flex flex-col gap-1 sm:w-40">
                        <Label htmlFor={`date-${row.id}`} className="text-xs text-muted-foreground">
                          Deposition date
                        </Label>
                        <Input
                          id={`date-${row.id}`}
                          type="date"
                          value={row.depositionDate}
                          onChange={(e) => updateRow(row.id, { depositionDate: e.target.value })}
                          disabled={busy}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        onClick={() => removeRow(row.id)}
                        className="cursor-pointer self-end sm:self-auto"
                        aria-label={`Remove ${row.file.name}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {busy && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex flex-col gap-1"
              >
                <Progress value={stage === "uploading" ? 50 : 90} />
                <span className="text-xs text-muted-foreground">
                  {stage === "uploading" ? "Uploading transcripts…" : "Starting analysis…"}
                </span>
              </motion.div>
            )}

            <Button onClick={startAnalysis} disabled={busy || rows.length === 0} className="cursor-pointer">
              {busy ? "Starting…" : "Start Analysis"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
