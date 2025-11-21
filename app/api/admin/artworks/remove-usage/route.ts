import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-client';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { artworkId, usageId } = await request.json();
    
    if (!artworkId || !usageId) {
      return NextResponse.json({ error: 'Artwork ID and Usage ID are required' }, { status: 400 });
    }
    
    // Parse usageId which is in format: characterId-characterType-usageType
    const [characterId, characterType, usageType] = usageId.split('-');
    
    if (!characterId || !characterType || !usageType) {
      return NextResponse.json({ error: 'Invalid usage ID format' }, { status: 400 });
    }
    
    // Delete the character_artwork relationship
    const { error } = await supabase
      .from('character_artworks')
      .delete()
      .eq('artwork_id', artworkId)
      .eq('character_id', characterId)
      .eq('character_type', characterType)
      .eq('usage_type', usageType);
    
    if (error) {
      console.error('Error removing usage:', error);
      throw error;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing usage:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove usage' },
      { status: 500 }
    );
  }
}
