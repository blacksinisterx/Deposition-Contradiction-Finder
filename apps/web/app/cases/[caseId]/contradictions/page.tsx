"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { ArrowLeft, ScrollText } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Severity = "high" | "medium" | "low";
type Status = "confirmed" | "consistent" | "needs_review";
type Contradiction = {
  id: string;
  status: Status;
  severity: Severity;
  claim_a: { witness_name: string; claim_text: string } | null;
  claim_b: { witness_name: string; claim_text: string } | null;
};

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const SEVERITY_STYLES: Record<Severity, string> = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-primary text-primary-foreground",
  low: "bg-muted text-muted-foreground",
};
const SEVERITY_BORDER: Record<Severity, string> = {
  high: "var(--destructive)",
  medium: "var(--primary)",
  low: "var(--border)",
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

function BackLink({ caseId }: { caseId: string }) {
  return (
    <Link
      href={`/cases/${caseId}/timeline`}
      className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to timeline
    </Link>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export default function ContradictionsList() {
  const { caseId } = useParams<{ caseId: string }>();
  const [contradictions, setContradictions] = useState<Contradiction[] | null>(null);

  useEffect(() => {
    supabase
      .from("contradictions")
      .select(
        "id, status, severity, claim_a:claims!claim_a_id(witness_name, claim_text), claim_b:claims!claim_b_id(witness_name, claim_text)",
      )
      .eq("case_id", caseId)
      .then(({ data }) => {
        const sorted = [...((data as unknown as Contradiction[]) ?? [])].sort(
          (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
        );
        setContradictions(sorted);
      });
  }, [caseId]);

  if (!contradictions) {
    return (
      <div className="flex flex-1 flex-col gap-(--space-md) p-6">
        <BackLink caseId={caseId} />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (contradictions.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-(--space-md) p-6">
        <BackLink caseId={caseId} />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No contradictions found for this case.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 justify-center p-6">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex w-full max-w-2xl flex-col gap-(--space-sm)"
      >
        <motion.div variants={item}>
          <BackLink caseId={caseId} />
        </motion.div>
        <motion.h1 variants={item} className="font-heading text-xl">
          Contradictions
        </motion.h1>
        {contradictions.map((c) => (
          <motion.div key={c.id} variants={item}>
            <Link href={`/cases/${caseId}/contradictions/${c.id}`}>
              <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 350, damping: 24 }}>
                <Card
                  className="cursor-pointer border-l-2 transition-shadow duration-300 hover:shadow-(--shadow-lg)"
                  style={{ borderLeftColor: SEVERITY_BORDER[c.severity] }}
                >
                  <CardContent className="flex flex-col gap-(--space-sm)">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <ScrollText className="size-4 text-muted-foreground" />
                        {c.claim_a?.witness_name} vs {c.claim_b?.witness_name}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className={STATUS_STYLES[c.status]}>
                          {STATUS_LABELS[c.status]}
                        </Badge>
                        <Badge className={SEVERITY_STYLES[c.severity]}>{c.severity}</Badge>
                      </div>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{c.claim_a?.claim_text}</p>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
