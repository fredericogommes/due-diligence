import { describeStaleness, type Staleness } from "@/lib/report/staleness";

/** Aviso: entrou evidência nova depois da última versão revisada/assinada do relatório. */
export function StaleBanner({ s, href }: { s: Staleness; href?: string }) {
  return (
    <div role="alert" className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-text print:hidden">
      <p className="font-semibold text-warn">Nova revisão necessária</p>
      <p className="mt-0.5">
        Depois da versão {s.version} {s.status === "assinado" ? "assinada" : "revisada"} {s.total === 1 ? "entrou" : "entraram"} {describeStaleness(s)}. Essa versão continua valendo para o
        retrato que congelou, mas não reflete mais o negócio: salve uma nova versão e submeta à revisão jurídica.
        {href && (
          <>
            {" "}
            <a href={href} className="font-medium text-brand underline">Abrir relatório</a>
          </>
        )}
      </p>
    </div>
  );
}
