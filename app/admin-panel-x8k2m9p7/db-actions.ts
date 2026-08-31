'use server';
// Guarded server-side proxy for admin database + storage operations.
// Every call requires a valid admin session cookie, and table/bucket names are
// allow-listed so a caller cannot reach anything the panel does not use.
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from './admin-session';

const TABLES = new Set([
  'killers', 'survivors', 'p100_players', 'p100_submissions', 'artists',
  'artworks', 'character_artworks',
  'blacklisted_users', 'vip_users', 'v_character_artworks',
]);

const BUCKETS = new Set([
  'artworks', 'screenshots', 'killerimages', 'survivors',
  'backgrounds', 'survivorbackgrounds',
]);

type Filter = { op: string; col: string; val: any; operator?: string };

export type DbOp = {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  payload?: any;
  upsertOptions?: any;
  columns?: string;
  returning?: boolean;
  filters?: Filter[];
  order?: { col: string; ascending: boolean };
  limit?: number;
  single?: boolean;
  maybeSingle?: boolean;
};

const ok = (data: any) => ({ data: data ?? null, error: null });
const fail = (message: string, code?: string) => ({ data: null, error: { message, code } });

export async function adminDb(op: DbOp) {
  try {
    await requireAdmin();
  } catch {
    return fail('Unauthorized: admin session required.', '401');
  }
  if (!op || !TABLES.has(op.table)) return fail(`Table not allowed: ${op?.table}`, '403');

  const sb = createAdminClient();
  let q: any = sb.from(op.table as any);

  switch (op.action) {
    case 'select': q = q.select(op.columns ?? '*'); break;
    case 'insert': q = q.insert(op.payload); break;
    case 'update': q = q.update(op.payload); break;
    case 'delete': q = q.delete(); break;
    case 'upsert': q = q.upsert(op.payload, op.upsertOptions ?? undefined); break;
    default: return fail(`Unsupported action: ${op.action}`, '400');
  }

  for (const f of op.filters ?? []) {
    switch (f.op) {
      case 'eq': q = q.eq(f.col, f.val); break;
      case 'neq': q = q.neq(f.col, f.val); break;
      case 'in': q = q.in(f.col, f.val); break;
      case 'is': q = q.is(f.col, f.val); break;
      case 'contains': q = q.contains(f.col, f.val); break;
      case 'ilike': q = q.ilike(f.col, f.val); break;
      case 'like': q = q.like(f.col, f.val); break;
      case 'gte': q = q.gte(f.col, f.val); break;
      case 'lte': q = q.lte(f.col, f.val); break;
      case 'not': q = q.not(f.col, f.operator as string, f.val); break;
      case 'filter': q = q.filter(f.col, f.operator as string, f.val); break;
      default: return fail(`Unsupported filter: ${f.op}`, '400');
    }
  }

  if (op.action !== 'select' && op.returning) q = q.select(op.columns ?? '*');
  if (op.order) q = q.order(op.order.col, { ascending: op.order.ascending });
  if (typeof op.limit === 'number') q = q.limit(op.limit);
  if (op.single) q = q.single();
  else if (op.maybeSingle) q = q.maybeSingle();

  const { data, error } = await q;
  if (error) return fail(error.message, (error as any).code);
  return ok(data);
}

export async function adminStorage(
  bucket: string,
  action: 'list' | 'remove' | 'move' | 'copy',
  args: any
) {
  try {
    await requireAdmin();
  } catch {
    return fail('Unauthorized: admin session required.', '401');
  }
  if (!BUCKETS.has(bucket)) return fail(`Bucket not allowed: ${bucket}`, '403');

  const store = createAdminClient().storage.from(bucket);
  let res: any;
  switch (action) {
    case 'list': res = await store.list(args?.prefix ?? '', args?.options ?? undefined); break;
    case 'remove': res = await store.remove(args?.paths ?? []); break;
    case 'move': res = await store.move(args?.from, args?.to); break;
    case 'copy': res = await store.copy(args?.from, args?.to); break;
    default: return fail(`Unsupported storage action: ${action}`, '400');
  }
  if (res?.error) return fail(res.error.message, (res.error as any).statusCode);
  return ok(res?.data);
}

export async function adminStorageUpload(formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return fail('Unauthorized: admin session required.', '401');
  }
  const bucket = String(formData.get('bucket') ?? '');
  const path = String(formData.get('path') ?? '');
  const file = formData.get('file') as File | null;
  if (!BUCKETS.has(bucket)) return fail(`Bucket not allowed: ${bucket}`, '403');
  if (!file || !path) return fail('File and path are required.', '400');

  let options: any = {};
  try { options = JSON.parse(String(formData.get('options') ?? '{}')); } catch { options = {}; }

  const res = await createAdminClient().storage.from(bucket).upload(path, file, options);
  if (res.error) return fail(res.error.message, (res.error as any).statusCode);
  return ok(res.data);
}
