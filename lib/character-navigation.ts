import { createServerClient } from './supabase-client';

export interface NavigationItem {
  id: string;
  name: string;
  type: 'killer' | 'survivor';
  imageUrl: string;
}

export interface NavigationResult {
  previous: NavigationItem | null;
  next: NavigationItem | null;
}

export async function getCharacterNavigation(
  currentId: string,
  type: 'killer' | 'survivor'
): Promise<NavigationResult> {
  const supabase = createServerClient();
  
  // Get all characters of the same type, ordered
  const tableName = type === 'killer' ? 'killers' : 'survivors';
  const orderColumn = type === 'killer' ? 'order' : 'order_num';
  
  const { data: characters, error } = await supabase
    .from(tableName)
    .select('id, name, image_url')
    .order(orderColumn, { ascending: true });
  
  if (error || !characters) {
    console.error(`Error fetching ${type}s for navigation:`, error);
    return { previous: null, next: null };
  }
  
  // Find current character index
  const currentIndex = characters.findIndex(char => char.id === currentId);
  
  if (currentIndex === -1) {
    return { previous: null, next: null };
  }
    // Get previous and next characters (only within the same type)
  let previous: NavigationItem | null = null;
  let next: NavigationItem | null = null;
  
  // Previous character: go to previous in list, or wrap to last if at first
  if (currentIndex > 0) {
    const prevChar = characters[currentIndex - 1];
    previous = {
      id: prevChar.id,
      name: prevChar.name,
      type,
      imageUrl: prevChar.image_url
    };
  } else if (characters.length > 1) {
    // Wrap to last character of the same type
    const lastChar = characters[characters.length - 1];
    previous = {
      id: lastChar.id,
      name: lastChar.name,
      type,
      imageUrl: lastChar.image_url
    };
  }
  
  // Next character: go to next in list, or wrap to first if at last
  if (currentIndex < characters.length - 1) {
    const nextChar = characters[currentIndex + 1];
    next = {
      id: nextChar.id,
      name: nextChar.name,
      type,
      imageUrl: nextChar.image_url
    };
  } else if (characters.length > 1) {
    // Wrap to first character of the same type
    const firstChar = characters[0];
    next = {
      id: firstChar.id,
      name: firstChar.name,
      type,
      imageUrl: firstChar.image_url
    };
  }
  
  return { previous, next };
}
