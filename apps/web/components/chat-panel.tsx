"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Message = { id: string; role: "user" | "assistant"; content: string };

export function ChatPanel({ contradictionId }: { contradictionId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("messages")
      .select("id, role, content")
      .eq("contradiction_id", contradictionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages((data as Message[]) ?? []));
  }, [contradictionId]);

  function scrollChatToBottom() {
    const viewport = bottomRef.current?.closest('[data-slot="scroll-area-viewport"]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { id: `pending-${Date.now()}`, role: "user", content }]);
    requestAnimationFrame(scrollChatToBottom);

    const res = await fetch(`/api/contradictions/${contradictionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const body = await res.json();
    setSending(false);

    if (!res.ok) {
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: "assistant", content: `Error: ${body.error ?? res.statusText}` },
      ]);
      requestAnimationFrame(scrollChatToBottom);
      return;
    }

    setMessages((prev) => [
      ...prev.filter((m) => !m.id.startsWith("pending-")),
      body.userMessage,
      body.assistantMessage,
    ]);
    requestAnimationFrame(scrollChatToBottom);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-sm text-muted-foreground">Ask about this contradiction</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-(--space-sm)">
        <ScrollArea className="h-64 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-col gap-(--space-sm)">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask a follow-up question about these two statements or the reasoning above.
              </p>
            )}
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground shadow-(--shadow-sm)"
                      : "mr-auto border border-border bg-background text-foreground"
                  }`}
                >
                  {m.content}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Why does the warning light detail matter here?"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !input.trim()} className="cursor-pointer">
            {sending ? "…" : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
