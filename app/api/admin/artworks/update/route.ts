import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-client';
import { updateArtworkArtist } from '@/lib/artwork-management';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { artworkId, artistName, artistUrl, platform } = await request.json();
    
    if (!artworkId) {
      return NextResponse.json({ error: 'Artwork ID is required' }, { status: 400 });
    }
    
    await updateArtworkArtist(artworkId, artistName, artistUrl, platform);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating artwork:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update artwork' },
      { status: 500 }
    );
  }
}
