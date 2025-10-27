'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase-client';
import { 
  getArtists as getArtistsService, 
  createArtist as createArtistService, 
  deleteArtist as deleteArtistService, 
  updateArtist as updateArtistService 
} from '@/lib/artists-service';
import { updatePlayerPriority } from '@/lib/players-service';

// --- UTILITY ACTION (used by other actions) ---

async function uploadImageToStorage(file: File, bucket: string, path: string): Promise<string> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: true });
  if (error) {
    console.error('Storage Upload Error:', error);
    throw new Error(`Failed to upload to ${bucket}: ${error.message}`);
  }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
};

// --- SUBMISSION ACTIONS ---

export async function updateSubmissionStatusAction(
  submissionId: string, 
  status: 'approved' | 'rejected', 
  rejectionReason: string | undefined,
  submission: { username: string, killer_id?: string, survivor_id?: string }
) {
  try {
    const supabase = createAdminClient();
    await supabase.from('p100_submissions').update({ 
      status, 
      rejection_reason: status === 'rejected' ? rejectionReason : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'admin'
    }).eq('id', submissionId).throwOnError();

    if (status === 'approved') {
      const characterColumn = submission.killer_id ? 'killer_id' : 'survivor_id';
      const characterId = submission.killer_id || submission.survivor_id;
      
      const { data: existingPlayer } = await supabase.from('p100_players').select('id').eq('username', submission.username).eq(characterColumn, characterId).single();

      if (!existingPlayer) {
        await supabase.from('p100_players').insert({ 
          username: submission.username, 
          [characterColumn]: characterId, 
          p200: false,
          legacy: false,
          favorite: false
        }).throwOnError();
      }
    }
    revalidatePath('/admin');
    return { success: true, message: `Submission ${status}.` };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to update submission.' };
  }
}

export async function deleteSubmissionScreenshotAction(submissionId: string, screenshotUrl: string) {
  try {
    const supabase = createAdminClient();
    const urlRegex = /storage\/v1\/object\/public\/([^/]+)\/(.*)/;
    const match = screenshotUrl.match(urlRegex);
    if (!match) throw new Error("Could not parse screenshot URL.");

    const bucketName = match[1];
    const filePath = decodeURIComponent(match[2]);

    const { error } = await supabase.storage.from(bucketName).remove([filePath]);
    if (error) throw error;
    await supabase.from('p100_submissions').update({ screenshot_url: '' }).eq('id', submissionId).throwOnError();
    
    revalidatePath('/admin');
    return { success: true, message: 'Screenshot deleted.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to delete screenshot.' };
  }
}

export async function bulkDeleteScreenshotsAction(submissions: { id: string; screenshot_url: string }[]) {
  const pathsToDelete: string[] = [];
  const idsToUpdate: string[] = [];
  const urlRegex = /storage\/v1\/object\/public\/([^/]+)\/(.*)/;

  for (const sub of submissions) {
      const match = sub.screenshot_url.match(urlRegex);
      if (match && match[1] === 'screenshots') {
          pathsToDelete.push(decodeURIComponent(match[2]));
          idsToUpdate.push(sub.id);
      }
  }
  if (pathsToDelete.length === 0) {
    return { success: false, message: 'No valid screenshot paths found to delete.' };
  }
  try {
    const supabase = createAdminClient();
    const { error: storageError } = await supabase.storage.from('screenshots').remove(pathsToDelete);
    if (storageError) throw storageError;
    await supabase.from('p100_submissions').update({ screenshot_url: '' }).in('id', idsToUpdate).throwOnError();

    revalidatePath('/admin');
    return { success: true, message: `Successfully deleted ${pathsToDelete.length} screenshots.` };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to delete all screenshots.' };
  }
}

export async function addArtworkToCharacterAction(formData: FormData) {
  try {
    const supabase = createAdminClient();

    const artworkFile = formData.get('artworkFile') as File;
    const characterId = formData.get('characterId') as string;
    const characterType = formData.get('characterType') as 'killer' | 'survivor';
    const artistId = formData.get('artistId') as string;
    const placement = formData.get('placement') as 'gallery' | 'header' | 'legacy_header';

    if (!artworkFile || !characterId || !artistId) {
      throw new Error('Artwork file, character, and artist are required.');
    }
    
    // To create a nice filename, we fetch the artist's name
    const { data: artist, error: artistError } = await supabase.from('artists').select('name').eq('id', artistId).single();
    if (artistError) throw new Error('Could not find selected artist.');

    const artistSlug = (artist.name || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const timestamp = Date.now();
    const fileExtension = artworkFile.name.split('.').pop();
    const fileName = `${characterId}-${artistSlug}-${timestamp}.${fileExtension}`;
    
    const artworkUrl = await uploadImageToStorage(artworkFile, 'artworks', fileName);
    
    const tableName = characterType === 'killer' ? 'killers' : 'survivors';
    const { data: character, error: fetchError } = await supabase.from(tableName).select('artist_urls, legacy_header_urls').eq('id', characterId).single();
    if (fetchError) throw fetchError;
    
    let updateData = {};
    if (placement === 'gallery') {
      const currentUrls = character.artist_urls || [];
      updateData = { artist_urls: [...currentUrls, artworkUrl] };
    } else if (placement === 'header') {
      updateData = { header_url: artworkUrl };
    } else if (placement === 'legacy_header') {
      const currentUrls = character.legacy_header_urls || [];
      updateData = { legacy_header_urls: [...currentUrls, artworkUrl] };
    }
    
    await supabase.from(tableName).update(updateData).eq('id', characterId).throwOnError();
    
    revalidatePath('/admin');
    revalidatePath(`/${tableName}/${characterId}`); // Invalidate the character's public page cache

    return { success: true, message: 'Artwork added successfully!' };

  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to upload artwork.' };
  }
}

// --- CHARACTER & PLAYER ACTIONS ---

export async function createNewCharacterAction(formData: FormData) {
  try {
      const supabase = createAdminClient();
      const timestamp = Date.now();

      const name = formData.get('name') as string;
      const id = formData.get('id') as string;
      const type = formData.get('type') as 'killer' | 'survivor';
      const imageFile = formData.get('image') as File;
      const backgroundImageFile = formData.get('backgroundImage') as File | null;
      const headerImageFile = formData.get('headerImage') as File | null;
      const artistImageFiles = formData.getAll('artistImages') as File[];

      if (!name || !id || !imageFile) throw new Error('Name, ID, and character image are required.');
      
      const imageUrl = await uploadImageToStorage(imageFile, type === 'killer' ? 'killerimages' : 'survivors', `${id}.${imageFile.name.split('.').pop()}`);
      
      let backgroundImageUrl: string | null = null;
      if (backgroundImageFile && backgroundImageFile.size > 0) {
        backgroundImageUrl = await uploadImageToStorage(backgroundImageFile, type === 'killer' ? 'backgrounds' : 'survivorbackgrounds', `${id}.${backgroundImageFile.name.split('.').pop()}`);
      }

      let headerUrl: string | null = null;
      if (headerImageFile && headerImageFile.size > 0) {
        headerUrl = await uploadImageToStorage(headerImageFile, 'backgrounds', `${id}-header.${headerImageFile.name.split('.').pop()}`);
      }

      const artistUrls = await Promise.all(
        artistImageFiles
          .filter(f => f.size > 0)
          .map((file, i) => uploadImageToStorage(file, 'artworks', `${id}-artwork-${i + 1}-${timestamp}.${file.name.split('.').pop()}`))
      );
      
      const tableName = type === 'killer' ? 'killers' : 'survivors';
      const orderField = type === 'killer' ? 'order' : 'order_num';
      const { data: chars } = await supabase.from(tableName).select(orderField);
      const maxOrder = Math.max(...(chars?.map((c: any) => c[orderField] || 0) || [0]), 0);
      
      await supabase.from(tableName).insert({
        id, name, image_url: imageUrl, background_image_url: backgroundImageUrl, header_url: headerUrl, artist_urls: artistUrls, [orderField]: maxOrder + 1,
      }).throwOnError();
      
      revalidatePath('/admin');
      return { success: true, message: `${type} "${name}" created!` };
  } catch (error: any) {
      return { success: false, message: error.message || 'Failed to create character.' };
  }
}

export async function saveCharacterAction(characterData: any, type: 'killer' | 'survivor') {
  try {
    const supabase = createAdminClient();
    const tableName = type === 'killer' ? 'killers' : 'survivors';
    const { id, created_at, ...updateData } = characterData;

    if (id && created_at) { // Existing character
      await supabase.from(tableName).update(updateData).eq('id', id).throwOnError();
    } else { // New character
      await supabase.from(tableName).insert(updateData).throwOnError();
    }
    revalidatePath('/admin');
    return { success: true, message: `${type} saved successfully.` };
  } catch(error: any) {
    return { success: false, message: `Failed to save ${type}: ${error.message}` };
  }
}

export async function deleteCharacterAction(characterId: string, type: 'killer' | 'survivor') {
  try {
    const supabase = createAdminClient();
    const playerColumn = type === 'killer' ? 'killer_id' : 'survivor_id';
    const tableName = type === 'killer' ? 'killers' : 'survivors';
    
    await supabase.from('p100_players').delete().eq(playerColumn, characterId);
    await supabase.from('p100_submissions').delete().eq(playerColumn, characterId);
    await supabase.from(tableName).delete().eq('id', characterId);

    revalidatePath('/admin');
    return { success: true, message: `${type} deleted.` };
  } catch (error: any) {
    return { success: false, message: `Failed to delete ${type}: ${error.message}` };
  }
}

export async function savePlayerAction(playerData: any) {
  try {
    const supabase = createAdminClient();
    const { id, killers, survivors, ...updateData } = playerData;
    updateData.username = updateData.username.trim();

    if (id) {
      await supabase.from('p100_players').update(updateData).eq('id', id).throwOnError();
    } else {
      await supabase.from('p100_players').insert(updateData).throwOnError();
    }
    revalidatePath('/admin');
    return { success: true, message: 'Player saved.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to save player.' };
  }
}

export async function deletePlayerAction(playerId: string) {
  try {
    const supabase = createAdminClient();
    await supabase.from('p100_players').delete().eq('id', playerId).throwOnError();
    revalidatePath('/admin');
    return { success: true, message: 'Player deleted.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to delete player.' };
  }
}

// Player priority update
export async function updatePlayerPriorityAction(playerId: string, priority: number) {
  try {
    if (!playerId) return { success: false, message: 'Player ID required.' };
    if (!Number.isFinite(priority)) return { success: false, message: 'Priority must be a number.' };
    const supabase = createAdminClient();
    await updatePlayerPriority(supabase, playerId, priority);
    revalidatePath('/admin');
    // Try to find related character to revalidate its public page
    const { data: playerRow } = await supabase
      .from('p100_players')
      .select('killer_id, survivor_id')
      .eq('id', playerId)
      .single();
    if (playerRow?.killer_id) {
      revalidatePath(`/killers/${playerRow.killer_id}`);
    } else if (playerRow?.survivor_id) {
      revalidatePath(`/survivors/${playerRow.survivor_id}`);
    }
    return { success: true, message: 'Priority updated.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to update priority.' };
  }
}

// --- ARTIST ACTIONS ---

export async function getArtistsAction() {
    try {
        const adminClient = createAdminClient();
        const artists = await getArtistsService(adminClient);
        return { success: true, data: artists };
    } catch (error: any) {
        return { success: false, message: "Failed to fetch artists." };
    }
}

export async function saveArtistAction(artistData: any) {
    try {
        const adminClient = createAdminClient();
        const { id, created_at, slug, ...updateData } = artistData;
        if (id) {
            await updateArtistService(adminClient, id, updateData);
        } else {
            await createArtistService(adminClient, updateData);
        }
        revalidatePath('/admin');
        return { success: true, message: 'Artist saved successfully.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to save artist.' };
    }
}

export async function deleteArtistAction(artistId: string) {
    try {
        const adminClient = createAdminClient();
        await deleteArtistService(adminClient, artistId);
        revalidatePath('/admin');
        return { success: true, message: 'Artist deleted.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to delete artist.' };
    }
}

// --- STORAGE ACTIONS ---

export async function getStorageItemsAction(bucket: string) {
  try {
    const supabase = createAdminClient();
    const allItems: any[] = [];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    const listItemsRecursively = async (pathPrefix = '') => {
      const { data, error } = await supabase.storage.from(bucket).list(pathPrefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      if (!data) return;

      for (const item of data) {
        const fullPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;
        if (item.id === null) { // It's a folder
          await listItemsRecursively(fullPath);
        } else { // It's a file
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeURI(fullPath)}`;
          allItems.push({ name: item.name, path: fullPath, bucket, publicUrl, created_at: item.created_at, updated_at: item.updated_at, size: item.metadata?.size || 0 });
        }
      }
    };
    await listItemsRecursively();
    allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, data: allItems };
  } catch (error: any) {
    return { success: false, message: `Failed to fetch items from ${bucket}: ${error.message}` };
  }
}

export async function uploadFilesAction(formData: FormData) {
  try {
    const files = formData.getAll('files') as File[];
    const bucket = formData.get('bucket') as string;
    const folder = formData.get('folder') as string;
    if (!files || files.length === 0 || !bucket) {
      throw new Error('Files and bucket are required.');
    }
    await Promise.all(
      files.map(file => {
        const path = folder && folder !== 'Root'
            ? `${folder}/${Date.now()}-${file.name}`
            : `${Date.now()}-${file.name}`;
        return uploadImageToStorage(file, bucket, path);
      })
    );
    revalidatePath('/admin');
    return { success: true, message: `${files.length} file(s) uploaded.` };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to upload files.' };
  }
}

export async function createFolderAction(bucket: string, folderName: string) {
  try {
    const placeholderFile = new File([''], '.placeholder', { type: 'text/plain' });
    await uploadImageToStorage(placeholderFile, bucket, `${folderName}/.placeholder`);
    revalidatePath('/admin');
    return { success: true, message: `Folder "${folderName}" created.` };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to create folder.' };
  }
}

export async function deleteStorageItemAction(bucket: string, path: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
    revalidatePath('/admin');
    return { success: true, message: 'File deleted.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to delete file.' };
  }
}