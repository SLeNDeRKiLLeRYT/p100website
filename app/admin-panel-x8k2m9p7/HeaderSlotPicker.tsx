'use client';

// Legacy header slot control (invoice item 17).
//
// A character page draws its two legacy header artworks side by side. Which one
// lands on the left and which on the right is decided by display_order on the
// character_artworks rows, so this control just writes 0 to the left one and 1
// to the right one. Anything else that happens to be tagged legacy_header gets
// pushed after them.

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createAdminClient } from '@/lib/admin-proxy';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface SlotRow {
  id: string;
  artwork_url: string;
  display_order: number | null;
  usage_type: string;
}

function fileName(url: string) {
  try {
    return decodeURIComponent(url.split('/').pop() || url);
  } catch {
    return url;
  }
}

export default function HeaderSlotPicker({
  characterId,
  characterType,
  artworks,
  onSaved,
}: {
  characterId: string;
  characterType: 'killer' | 'survivor';
  artworks: any[] | undefined;
  onSaved?: () => void;
}) {
  const { toast } = useToast();

  const rows: SlotRow[] = (artworks || [])
    .filter((a: any) => a.usage_type === 'legacy_header')
    .slice()
    .sort(
      (a: any, b: any) =>
        (a.display_order ?? 9999) - (b.display_order ?? 9999)
    );

  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Seed the pickers from whatever order the page is currently using.
  useEffect(() => {
    setLeftId(rows[0]?.id || '');
    setRightId(rows[1]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, characterType, rows.length]);

  if (rows.length < 2) {
    return (
      <div className="rounded border border-red-800 bg-black/50 p-3">
        <Label className="text-white">Header Slots</Label>
        <p className="text-xs text-gray-400 mt-1">
          Add two legacy header artworks above and the left/right control will appear
          here.
        </p>
      </div>
    );
  }

  const swap = () => {
    const l = leftId;
    setLeftId(rightId);
    setRightId(l);
  };

  const save = async () => {
    if (!leftId || !rightId) {
      toast({
        title: 'Pick both slots',
        description: 'Choose an artwork for the left and the right slot.',
        variant: 'destructive',
      });
      return;
    }
    if (leftId === rightId) {
      toast({
        title: 'Same artwork twice',
        description: 'The left and right slots must be different artworks.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const supabaseAdmin = createAdminClient();

      // Left = 0, right = 1, everything else after them so the page always
      // picks these two first.
      const ordered: Array<{ id: string; order: number }> = [
        { id: leftId, order: 0 },
        { id: rightId, order: 1 },
      ];
      let next = 2;
      for (const r of rows) {
        if (r.id !== leftId && r.id !== rightId) {
          ordered.push({ id: r.id, order: next++ });
        }
      }

      for (const item of ordered) {
        const { error } = await supabaseAdmin
          .from('character_artworks')
          .update({ display_order: item.order })
          .eq('id', item.id);
        if (error) throw error;
      }

      toast({
        title: 'Header slots saved',
        description: 'Reload the character page to see the new order.',
      });
      onSaved?.();
    } catch (e: any) {
      toast({
        title: 'Could not save header slots',
        description: e?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const preview = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) {
      return (
        <div className="h-24 flex items-center justify-center text-xs text-gray-500 border border-red-900 rounded bg-black/40">
          Nothing selected
        </div>
      );
    }
    return (
      <div className="relative h-24 border border-red-900 rounded bg-black/40 overflow-hidden">
        <Image
          src={row.artwork_url}
          alt="Header slot preview"
          fill
          className="object-contain"
          unoptimized
        />
      </div>
    );
  };

  const options = (selectedId: string, onChange: (v: string) => void) => (
    <select
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-black border border-red-600 text-white text-sm rounded px-2 py-1"
    >
      <option value="">Select artwork</option>
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {fileName(r.artwork_url)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="rounded border border-red-800 bg-black/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white">Header Slots</Label>
        <Button
          type="button"
          onClick={swap}
          size="sm"
          variant="outline"
          className="border-red-600 text-white hover:bg-red-900 h-7 text-xs"
        >
          Swap sides
        </Button>
      </div>

      <p className="text-xs text-gray-400">
        Choose which artwork shows on each side of the character page header.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-300">LEFT</p>
          {preview(leftId)}
          {options(leftId, setLeftId)}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-mono text-gray-300">RIGHT</p>
          {preview(rightId)}
          {options(rightId, setRightId)}
        </div>
      </div>

      <Button
        type="button"
        onClick={save}
        disabled={saving}
        className="bg-green-600 hover:bg-green-700 w-full h-8 text-sm"
      >
        {saving ? 'Saving...' : 'Save header slots'}
      </Button>
    </div>
  );
}
