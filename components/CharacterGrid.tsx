'use client';

import Image from "next/image";
import Link from "next/link";
import { Character } from "@/lib/data";
import { useImagePreload } from "@/hooks/useImagePreload";

interface CharacterGridProps {
  characters: Character[];
  type: "killer" | "survivor";
}

export default function CharacterGrid({ characters, type }: CharacterGridProps) {
  const { preloadRouteImages } = useImagePreload();

  // Handle empty state
  if (!characters || characters.length === 0) {
    return (
      <div className="character-grid">
        <div className="col-span-full text-center py-10 md:py-12 font-mono">
          <p className="text-base md:text-lg lg:text-xl">No {type}s found. Please check back later.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="character-grid gap-3 md:gap-4">
      {characters.map((character, index) => (
        <Link 
          href={`/${type}s/${character.id}`} 
          key={character.id} 
          className="character-card group"
          onMouseEnter={() => {
            // Preload character detail page images on hover
            preloadRouteImages(`/${type}s/${character.id}`);
          }}
        >
          <div className="relative h-full w-full overflow-hidden">
            <Image
              src={character.imageUrl}
              alt={character.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-110"
              sizes="(max-width: 640px) 80px, (max-width: 768px) 96px, (max-width: 1024px) 112px, (max-width: 1280px) 128px, 144px"
              priority={index < 6} // Prioritize first 6 images
              loading={index < 6 ? "eager" : "lazy"}
            />
           <div className="character-name text-[0.5rem] md:text-[0.625rem] font-mono font-semibold text-secondary shadow-text rounded-sm">
  {character.name.toUpperCase()}
</div>
          </div>
        </Link>
      ))}
    </div>
  );
}