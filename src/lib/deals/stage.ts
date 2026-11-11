import "server-only";
import { nextStage, type BoardRow, type Stage } from "@/lib/board";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Avança a etapa do negócio conforme o que já aconteceu (nunca volta).
 * Devolve a etapa anterior e a nova, para quem chamou decidir o próximo passo
 * (ex.: entrar em "consulta" dispara a consulta prévia automática).
 */
export async function syncStage(supabase: Supabase, dealId: string): Promise<{ from: Stage; to: Stage } | null> {
  const { data: row } = await supabase.from("deal_board").select("*").eq("id", dealId).maybeSingle<BoardRow>();
  if (!row) return null;
  const to = nextStage(row);
  if (to !== row.stage) await supabase.from("deals").update({ stage: to }).eq("id", dealId);
  return { from: row.stage, to };
}
