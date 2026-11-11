-- M0 — Organizações, perfis e membros, com RLS.
-- Toda tabela de negócio das próximas etapas pertence a uma organização (org_id)
-- e usa as funções is_org_member / has_org_role nas políticas.

create type public.member_role as enum ('owner', 'admin', 'advogado', 'corretor');

-- Perfil público do usuário (espelha auth.users) -----------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now()
);

-- Organização: escritório de advocacia ou imobiliária -------------------------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 2 and 120),
  cnpj       text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

-- Funções auxiliares das políticas (security definer evita recursão de RLS) ---
create function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create function public.has_org_role(p_org uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

-- Cria a organização e torna o usuário atual dono, numa só transação.
create function public.create_organization(p_name text, p_cnpj text default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;

  insert into public.organizations (name, cnpj, created_by)
  values (btrim(p_name), nullif(p_cnpj, ''), v_uid)
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org, v_uid, 'owner');

  return v_org;
end;
$$;

-- Perfil criado automaticamente no cadastro -----------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede que a organização fique sem dono ------------------------------------
create function public.ensure_owner_remains()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.organizations o where o.id = old.org_id)
     and not exists (
       select 1 from public.memberships m
       where m.org_id = old.org_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'a organização precisa de ao menos um dono' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_owner
  before update or delete on public.memberships
  for each row execute function public.ensure_owner_remains();

-- Permissões ------------------------------------------------------------------
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid, public.member_role[]) from public, anon;
revoke all on function public.create_organization(text, text) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.ensure_owner_remains() from public, anon, authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.member_role[]) to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;

revoke all on public.profiles, public.organizations, public.memberships from anon;
grant select, update on public.profiles to authenticated;
grant select, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships   enable row level security;

-- Perfis: o próprio e os de colegas de organização.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.user_id = profiles.id and public.is_org_member(m.org_id)
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Organizações: membros veem; dono/admin editam; só o dono apaga.
-- Inserção apenas pela função create_organization.
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_org_role(id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_org_role(id, array['owner', 'admin']::public.member_role[]));
create policy organizations_delete on public.organizations for delete to authenticated
  using (public.has_org_role(id, array['owner']::public.member_role[]));

-- Membros: colegas veem; dono gerencia todos; admin gerencia quem não é dono.
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_org_member(org_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (
    public.has_org_role(org_id, array['owner']::public.member_role[])
    or (public.has_org_role(org_id, array['admin']::public.member_role[]) and role <> 'owner')
  );
create policy memberships_update on public.memberships for update to authenticated
  using (
    public.has_org_role(org_id, array['owner']::public.member_role[])
    or (public.has_org_role(org_id, array['admin']::public.member_role[]) and role <> 'owner')
  )
  with check (
    public.has_org_role(org_id, array['owner']::public.member_role[])
    or (public.has_org_role(org_id, array['admin']::public.member_role[]) and role <> 'owner')
  );
create policy memberships_delete on public.memberships for delete to authenticated
  using (
    user_id = auth.uid() and role <> 'owner'
    or public.has_org_role(org_id, array['owner']::public.member_role[])
    or (public.has_org_role(org_id, array['admin']::public.member_role[]) and role <> 'owner')
  );
