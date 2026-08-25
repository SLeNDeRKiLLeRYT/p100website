// Server component gate. The ?key= secret and the admin password never reach
// the browser: both are checked here / in server actions.
import { notFound } from 'next/navigation';
import AdminPanelClient from './AdminPanelClient';

export const dynamic = 'force-dynamic';

export default function AdminPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const expected = process.env.ADMIN_SECRET_KEY;
  if (!expected || searchParams?.key !== expected) {
    notFound();
  }
  return <AdminPanelClient />;
}
