import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, priority } = body as { id?: string; priority?: number };
    if (!id || typeof priority !== 'number') {
      return NextResponse.json({ success: false, message: 'Invalid payload.' }, { status: 400 });
    }
    const supabase = createAdminClient();
    const clamped = Math.max(0, Math.floor(priority));
    const { error } = await supabase.from('p100_players').update({ priority: clamped }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Priority updated.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to update priority.' }, { status: 500 });
  }
}