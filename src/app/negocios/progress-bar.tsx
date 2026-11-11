import type { DealProgressRow } from "@/lib/db-types";

/** Barra empilhada: completo (verde), parcial (âmbar), faltante (vermelho); dispensado fica fora do total. */
export function ProgressBar({ progress }: { progress?: DealProgressRow }) {
  const total = progress ? progress.total - progress.dispensados : 0;
  if (!progress || total <= 0) return <span className="text-xs text-subtle">Sem itens</span>;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-1" title={`${progress.completos} completos, ${progress.parciais} parciais, ${progress.faltantes} faltantes`}>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <span className="bg-ok" style={{ width: pct(progress.completos) }} />
        <span className="bg-warn" style={{ width: pct(progress.parciais) }} />
        <span className="bg-danger/70" style={{ width: pct(progress.faltantes) }} />
      </div>
      <div className="text-xs text-subtle tabular-nums">
        {progress.completos}/{total} completos
      </div>
    </div>
  );
}
