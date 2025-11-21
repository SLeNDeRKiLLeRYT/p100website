import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-client';
import { deleteArtwork } from '@/lib/artwork-management';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { artworkId } = await request.json();
    
    if (!artworkId) {
      return NextResponse.json({ error: 'Artwork ID is required' }, { status: 400 });
    }
    
    await deleteArtwork(artworkId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting artwork:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete artwork' },
      { status: 500 }
    );
  }
}
