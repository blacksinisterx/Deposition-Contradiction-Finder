"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AnalysisStatus = "pending" | "running" | "completed" | "failed";
type ProgressEvent = { node: string; message: string; at: string };
type Analysis = {
  id: string;
  status: AnalysisStatus;
  progress: ProgressEvent[];
  cases: { name: string } | null;
};

const STATUS_STYLES: Record<AnalysisStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-secondary text-secondary-foreground",
  completed: "bg-primary text-primary-foreground shadow-(--shadow-sm)",
  failed: "bg-destructive/10 text-destructive",
};

export default function AnalysisView() {
  const { caseId, analysisId } = useParams<{ caseId: string; analysisId: string }>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("analyses")
      .select("id, status, progress, cases(name)")
      .eq("id", analysisId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data) return setNotFound(true);
        setAnalysis(data as unknown as Analysis);
      });

    const channel = supabase
      .channel(`analysis-${analysisId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "analyses", filter: `id=eq.${analysisId}` },
        (payload) => {
          setAnalysis((prev) => (prev ? { ...prev, ...(payload.new as Partial<Analysis>) } : prev));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [analysisId]);

  if (notFound) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Analysis not found.
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1 justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full max-w-2xl flex-col gap-(--space-md)"
      >
        <Link
          href="/new-case"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          New case
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">{analysis.cases?.name ?? "Analysis"}</CardTitle>
            <div className="flex items-center gap-2">
              {analysis.status === "running" && (
                <motion.span
                  className="size-2 rounded-full bg-secondary"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <Badge className={STATUS_STYLES[analysis.status]}>{analysis.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-(--space-md)">
            <ol className="relative flex flex-col gap-2 pl-4">
              {analysis.progress.length > 1 && (
                <div className="absolute top-3 bottom-3 left-[7px] w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />
              )}
              {analysis.progress.length === 0 && (
                <li className="text-sm text-muted-foreground">Waiting for the analysis to start…</li>
              )}
              <AnimatePresence initial={false}>
                {analysis.progress.map((event, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="relative flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="absolute top-1/2 -left-[19px] size-1.5 -translate-y-1/2 rounded-full bg-primary" />
                    <span className="font-mono text-xs text-primary">{event.node}</span>
                    <span className="text-foreground">{event.message}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>

            {analysis.status === "completed" && (
              <Button
                render={<Link href={`/cases/${caseId}/contradictions`} />}
                nativeButton={false}
                className="cursor-pointer"
              >
                View Contradictions
              </Button>
            )}
            {analysis.status === "failed" && (
              <p className="text-sm text-destructive">
                Analysis failed. Check the progress log above for details.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
