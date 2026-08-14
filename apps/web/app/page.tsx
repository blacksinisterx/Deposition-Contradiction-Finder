import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-(--space-lg) p-6 text-center">
      <div className="flex flex-col gap-(--space-sm)">
        <h1 className="max-w-xl text-4xl text-foreground">Deposition Contradiction Finder</h1>
        <p className="max-w-md text-muted-foreground">
          Upload witness depositions from a case. The agent builds a timeline for each witness and
          flags contradictions with exact page/line citations.
        </p>
      </div>
      <Button render={<Link href="/new-case" />} nativeButton={false} className="cursor-pointer">
        Start a new case
      </Button>
    </div>
  );
}
