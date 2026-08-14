"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { ArrowLeft, Quote } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatPanel } from "@/components/chat-panel";

type Severity = "high" | "medium" | "low";
type Status = "confirmed" | "consistent" | "needs_review";
type Claim = { id: string; witness_name: string; page: number; line: number; claim_text: string };
type Contradiction = {
  id: string;
  status: Status;
  severity: Severity;
  reasoning: string;
  claim_a: Claim | null;
  claim_b: Claim | null;
};

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-primary text-primary-foreground",
  low: "bg-muted text-muted-foreground",
};
const STATUS_STYLES: Record<Status, string> = {
  confirmed: "border-destructive text-destructive",
  consistent: "border-secondary text-secondary",
  needs_review: "border-primary text-primary",
};
const STATUS_LABELS: Record<Status, string> = {
  confirmed: "confirmed",
  consistent: "consistent",
  needs_review: "needs review",
};

function ClaimCard({ claim }: { claim: Claim }) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-heading text-sm">
          <span>{claim.witness_name}</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">
            p.{claim.page}:{claim.line}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <blockquote className="flex gap-2 text-sm text-foreground">
          <Quote className="size-4 shrink-0 text-muted-foreground" />
          <span>{claim.claim_text}</span>
        </blockquote>
      </CardContent>
    </Card>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export default function ContradictionDetail() {
  const { caseId, contradictionId } = useParams<{ caseId: string; contradictionId: string }>();
  const [contradiction, setContradiction] = useState<Contradiction | null>(null);

  useEffect(() => {
    supabase
      .from("contradictions")
      .select(
        "id, status, severity, reasoning, claim_a:claims!claim_a_id(id, witness_name, page, line, claim_text), claim_b:claims!claim_b_id(id, witness_name, page, line, claim_text)",
      )
      .eq("id", contradictionId)
      .maybeSingle()
      .then(({ data }) => setContradiction(data as unknown as Contradiction | null));
  }, [contradictionId]);

  if (!contradiction) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-1 justify-center p-6">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex w-full max-w-3xl flex-col gap-(--space-md)"
      >
        <motion.div variants={item}>
          <Link
            href={`/cases/${caseId}/contradictions`}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to contradictions
          </Link>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="font-heading text-base font-normal text-muted-foreground">Verdict</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={STATUS_STYLES[contradiction.status]}>
                  {STATUS_LABELS[contradiction.status]}
                </Badge>
                <Badge className={SEVERITY_STYLES[contradiction.severity]}>{contradiction.severity}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{contradiction.reasoning}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="flex flex-col gap-(--space-sm) sm:flex-row">
          {contradiction.claim_a && <ClaimCard claim={contradiction.claim_a} />}
          {contradiction.claim_b && <ClaimCard claim={contradiction.claim_b} />}
        </motion.div>

        <motion.div variants={item}>
          <ChatPanel contradictionId={contradiction.id} />
        </motion.div>
      </motion.div>
    </div>
  );
}
