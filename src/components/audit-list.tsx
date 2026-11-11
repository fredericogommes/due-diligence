import Link from "next/link";
import { describeAudit, formatDateTime, type AuditRow } from "@/lib/audit";

/** Lista do log de auditoria. `names` mapeia user_id → nome dos membros atuais. */
export function AuditList({ rows, names, showDealLink = false }: { rows: AuditRow[]; names: Record<string, string>; showDealLink?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-subtle">Nenhum registro ainda.</p>;
  return (
    <ol className="divide-y divide-line text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
          <span>
            <strong className="font-medium">{r.actor_id ? (names[r.actor_id] ?? "Ex-membro") : "Sistema"}</strong>{" "}
            {describeAudit(r)}
            {showDealLink && r.deal_id && r.table_name !== "deals" && (
              <> · <Link href={`/negocios/${r.deal_id}/historico`} className="text-brand underline">ver negócio</Link></>
            )}
          </span>
          <time dateTime={r.created_at} className="text-xs text-subtle">{formatDateTime(r.created_at)}</time>
        </li>
      ))}
    </ol>
  );
}
