import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = {};
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession:false } });

for (const t of ['killers','survivors']) {
  const { data, error } = await sb.from(t).select('id, background_image_url, background_credit_name, background_credit_url');
  if (error) { console.log(t, 'ERROR', error.message); continue; }
  const total = data.length;
  const withBg = data.filter(r => r.background_image_url).length;
  const withName = data.filter(r => r.background_credit_name).length;
  console.log(`${t}: ${total} rows | ${withBg} have a background | ${withName} have a credit name`);
  const named = data.filter(r => r.background_credit_name).slice(0,5).map(r => `${r.id}=${r.background_credit_name}`);
  if (named.length) console.log('   examples:', named.join(', '));
}
