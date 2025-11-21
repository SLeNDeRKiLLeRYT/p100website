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
    const { artworkId, characterId, characterType, usageType, displayOrder } = await request.json();
    
    if (!artworkId || !characterId || !characterType || !usageType) {
      return NextResponse.json({ 
        error: 'Artwork ID, Character ID, Character Type, and Usage Type are required' 
      }, { status: 400 });
    }
    
    // Check if this usage already exists
    const { data: existing } = await supabase
      .from('character_artworks')
      .select('id')
      .eq('artwork_id', artworkId)
      .eq('character_id', characterId)
      .eq('character_type', characterType)
      .eq('usage_type', usageType)
      .single();
    
    if (existing) {
      return NextResponse.json({ 
        error: 'This artwork is already assigned to this character with this usage type' 
      }, { status: 400 });
    }
    
    // Create the character_artwork relationship
    const { error } = await supabase
      .from('character_artworks')
      .insert({
        artwork_id: artworkId,
        character_id: characterId,
        character_type: characterType,
        usage_type: usageType,
        display_order: displayOrder
      });
    
    if (error) {
      console.error('Error adding usage:', error);
      throw error;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding usage:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add usage' },
      { status: 500 }
    );
  }
}
