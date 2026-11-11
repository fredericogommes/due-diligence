/**
 * Banco de teste em memória (PGlite) com um "esqueleto" mínimo do Supabase:
 * schema auth, auth.uid() lido do JWT simulado e os papéis anon/authenticated.
 * Aplica as migrações reais de supabase/migrations em ordem.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated;
`;

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

/** Cria um usuário em auth.users (como o Supabase Auth faria no cadastro). */
export async function createUser(db: PGlite, id: string, fullName = "Usuário"): Promise<void> {
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, `${id}@teste.local`, JSON.stringify({ full_name: fullName })],
  );
}

/**
 * Executa `fn` como o usuário `userId` (papel authenticated), dentro de uma
 * transação desfeita ao final — cada chamada começa do mesmo estado.
 * Use `commit: true` para persistir o efeito.
 */
export async function asUser<T>(
  db: PGlite,
  userId: string | null,
  fn: (q: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await db.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    const result = await fn(async (sql, params) => (await db.query(sql, params)).rows as never);
    await db.exec(commit ? "commit" : "rollback");
    return result;
  } catch (err) {
    await db.exec("rollback");
    throw err;
  }
}
