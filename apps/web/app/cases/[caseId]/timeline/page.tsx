"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { ArrowRight, User } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Claim = { id: string; witness_name: string; page: number; line: number; claim_text: string };

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export default function TimelinePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [caseName, setCaseName] = useState<string | null>(null);
  const [byWitness, setByWitness] = useState<Record<string, Claim[]> | null>(null);

  useEffect(() => {
    supabase
      .from("cases")
      .select("name")
      .eq("id", caseId)
      .maybeSingle()
      .then(({ data }) => setCaseName(data?.name ?? null));

    supabase
      .from("claims")
      .select("id, witness_name, page, line, claim_text, documents!inner(case_id)")
      .eq("documents.case_id", caseId)
      .order("page", { ascending: true })
      .order("line", { ascending: true })
      .then(({ data }) => {
        const grouped: Record<string, Claim[]> = {};
        for (const claim of (data as unknown as Claim[]) ?? []) {
          (grouped[claim.witness_name] ??= []).push(claim);
        }
        setByWitness(grouped);
      });
  }, [caseId]);

  if (!byWitness) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const witnesses = Object.keys(byWitness).sort();

  return (
    <div className="flex flex-1 justify-center p-6">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex w-full max-w-3xl flex-col gap-(--space-md)"
      >
        <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-xl">{caseName ?? "Timeline"}</h1>
          <Button
            render={<Link href={`/cases/${caseId}/contradictions`} />}
            nativeButton={false}
            variant="secondary"
            className="cursor-pointer"
          >
            Contradictions
            <ArrowRight className="size-4" />
          </Button>
        </motion.div>

        {witnesses.length === 0 && (
          <motion.p variants={item} className="text-muted-foreground">
            No claims extracted yet.
          </motion.p>
        )}

        {witnesses.map((witness) => (
          <motion.div key={witness} variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-heading text-base">
                  <User className="size-4 text-secondary" />
                  {witness}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative flex flex-col gap-(--space-md) pl-5">
                  <div className="absolute top-2 bottom-2 left-[7px] w-px bg-border" />
                  {byWitness[witness].map((claim) => (
                    <li key={claim.id} className="relative flex flex-col gap-1">
                      <span className="absolute top-1 -left-[19px] size-2 rounded-full bg-secondary" />
                      <span className="font-mono text-xs text-muted-foreground">
                        p.{claim.page}:{claim.line}
                      </span>
                      <p className="text-sm text-foreground">{claim.claim_text}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
