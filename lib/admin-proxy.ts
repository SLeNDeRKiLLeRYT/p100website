'use client';
// lib/admin-proxy.ts
// Browser-side stand-in for a Supabase service-role client.
// It exposes the same fluent surface the admin panel already uses, but every
// operation is forwarded to a server action that holds the secret key and
// checks the admin session cookie. NO KEY IS PRESENT IN THIS FILE OR THE BUNDLE.
import {
  adminDb, adminStorage, adminStorageUpload, type DbOp,
} from '@/app/admin-panel-x8k2m9p7/db-actions';

type Result = { data: any; error: any };

class AdminQuery implements PromiseLike<Result> {
  private op: DbOp;
  private shouldThrow = false;

  constructor(table: string) {
    this.op = { table, action: 'select', filters: [] };
  }

  select(columns = '*') {
    if (this.op.action === 'select') this.op.columns = columns;
    else { this.op.returning = true; this.op.columns = columns; }
    return this;
  }
  insert(payload: any) { this.op.action = 'insert'; this.op.payload = payload; return this; }
  update(payload: any) { this.op.action = 'update'; this.op.payload = payload; return this; }
  upsert(payload: any, options?: any) {
    this.op.action = 'upsert'; this.op.payload = payload; this.op.upsertOptions = options; return this;
  }
  delete() { this.op.action = 'delete'; return this; }

  private filter_(op: string, col: string, val: any, operator?: string) {
    (this.op.filters ||= []).push({ op, col, val, operator });
    return this;
  }
  eq(col: string, val: any) { return this.filter_('eq', col, val); }
  neq(col: string, val: any) { return this.filter_('neq', col, val); }
  in(col: string, val: any[]) { return this.filter_('in', col, val); }
  is(col: string, val: any) { return this.filter_('is', col, val); }
  contains(col: string, val: any) { return this.filter_('contains', col, val); }
  ilike(col: string, val: string) { return this.filter_('ilike', col, val); }
  like(col: string, val: string) { return this.filter_('like', col, val); }
  gte(col: string, val: any) { return this.filter_('gte', col, val); }
  lte(col: string, val: any) { return this.filter_('lte', col, val); }
  not(col: string, operator: string, val: any) { return this.filter_('not', col, val, operator); }
  filter(col: string, operator: string, val: any) { return this.filter_('filter', col, val, operator); }

  order(col: string, opts?: { ascending?: boolean }) {
    this.op.order = { col, ascending: opts?.ascending ?? true }; return this;
  }
  limit(n: number) { this.op.limit = n; return this; }
  single() { this.op.single = true; return this; }
  maybeSingle() { this.op.maybeSingle = true; return this; }
  throwOnError() { this.shouldThrow = true; return this; }

  private async run(): Promise<Result> {
    const res = await adminDb(this.op);
    if (this.shouldThrow && res.error) {
      const err: any = new Error(res.error.message);
      Object.assign(err, res.error);
      throw err;
    }
    return res;
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
  catch(onrejected?: ((reason: any) => any) | null) { return this.run().catch(onrejected); }
  finally(onfinally?: (() => void) | null) { return this.run().finally(onfinally); }
}

function bucketApi(bucket: string) {
  return {
    list: (prefix = '', options?: any) => adminStorage(bucket, 'list', { prefix, options }),
    remove: (paths: string[]) => adminStorage(bucket, 'remove', { paths }),
    move: (from: string, to: string) => adminStorage(bucket, 'move', { from, to }),
    copy: (from: string, to: string) => adminStorage(bucket, 'copy', { from, to }),
    upload: (path: string, file: File, options?: any) => {
      const fd = new FormData();
      fd.append('bucket', bucket);
      fd.append('path', path);
      fd.append('file', file);
      fd.append('options', JSON.stringify(options ?? {}));
      return adminStorageUpload(fd);
    },
    // Public URLs are derived, not secret — safe to build client-side (stays synchronous).
    getPublicUrl: (path: string) => ({
      data: {
        publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURI(path)}`,
      },
    }),
  };
}

/**
 * Drop-in replacement for the old service-role client.
 * Same call shape, no secret in the browser.
 */
export const createAdminClient = () => ({
  from: (table: string) => new AdminQuery(table),
  storage: { from: bucketApi },
});
