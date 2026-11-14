-- M13 — Estados dos achados com justificativa (MK-01 §3 "Achado" e Fase 5).
--
--   proposto   → sugerido pela IA ou por consulta; ainda não revisado por pessoa
--   confirmado → um membro da equipe confirmou (achado manual já nasce assim)
--   mitigado / aceito / resolvido / descartado → encerrados; exigem justificativa
--   "aceito" (risco aceito) exige revisor jurídico.
--
-- A coluna antiga `resolved` continua existindo e é mantida em sincronia pelo
-- banco (true nos estados encerrados), para não quebrar relatório, quadro e gestão.
-- Backfill: resolved=true → 'resolvido'; IA/consulta não resolvidos → 'proposto';
-- manuais não resolvidos → 'confirmado'. Sem justificativa inventada no histórico.
-- Reversão: drop do trigger/funções, das colunas novas e voltar a política findings_all.

alter table public.findings
  add column status text not null default 'confirmado'
    check (status in ('proposto', 'confirmado', 'mitigado', 'aceito', 'resolvido', 'descartado')),
  add column resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  add column status_changed_by uuid references auth.users (id) on delete set null,
  add column status_changed_at timestamptz;

update public.findings set status = case
  when resolved then 'resolvido'
  when source::text in ('ia', 'consulta') then 'proposto'
  else 'confirmado' end;

create function public.findings_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- O estado inicial vem da origem, não do cliente.
    new.status := case when new.source::text in ('ia', 'consulta') then 'proposto' else 'confirmado' end;
    new.resolved := false;
    new.resolution_note := null;
    new.status_changed_by := null;
    new.status_changed_at := null;
    return new;
  end if;

  -- Compatibilidade: quem ainda mexe só em `resolved` vira mudança de estado.
  if new.resolved is distinct from old.resolved and new.status = old.status then
    new.status := case when new.resolved then 'resolvido' else 'confirmado' end;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('mitigado', 'aceito', 'resolvido', 'descartado')
       and coalesce(btrim(new.resolution_note), '') = '' then
      raise exception 'informe a justificativa para encerrar o apontamento' using errcode = '23514';
    end if;
    if new.status = 'aceito' and auth.uid() is not null and not public.is_legal_reviewer(old.org_id) then
      raise exception 'só revisor jurídico aceita um risco' using errcode = '42501';
    end if;
    if new.status = 'proposto' then
      raise exception 'um apontamento não volta a proposto' using errcode = '23514';
    end if;
    if new.status in ('proposto', 'confirmado') then
      new.resolution_note := null;
    end if;
    new.status_changed_by := auth.uid();
    new.status_changed_at := now();
  else
    new.status_changed_by := old.status_changed_by;
    new.status_changed_at := old.status_changed_at;
  end if;

  new.resolved := new.status in ('mitigado', 'aceito', 'resolvido', 'descartado');
  return new;
end;
$$;

create trigger findings_status before insert or update on public.findings
  for each row execute function public.findings_status();
revoke all on function public.findings_status() from public, anon, authenticated;

-- Excluir só o que ainda não entrou na análise: proposta não revisada, ou
-- apontamento manual ainda não encerrado. O resto se encerra com justificativa
-- (descartado), preservando o histórico.
drop policy findings_all on public.findings;
create policy findings_select on public.findings for select to authenticated
  using (public.is_org_member(org_id));
create policy findings_insert on public.findings for insert to authenticated
  with check (public.is_org_member(org_id));
create policy findings_update on public.findings for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy findings_delete on public.findings for delete to authenticated
  using (public.is_org_member(org_id) and (status = 'proposto' or (source::text = 'manual' and status = 'confirmado')));
