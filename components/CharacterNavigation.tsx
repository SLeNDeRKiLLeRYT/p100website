import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavigationItem } from '@/lib/character-navigation';

interface CharacterNavigationProps {
  previous: NavigationItem | null;
  next: NavigationItem | null;
}

export default function CharacterNavigation({ previous, next }: CharacterNavigationProps) {
    return (
        <>
            {/* Previous Button - Left Side Middle */}
            {previous && (
                <div className="hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-50 flex-col items-center">
                    <Link
                        href={`/${previous.type === 'killer' ? 'killers' : 'survivors'}/${previous.id}`}
                        className="relative flex items-center justify-center w-20 h-32 bg-black/80 hover:bg-black/60 border-2 border-red-600 hover:border-red-400 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg backdrop-blur-sm group overflow-hidden"
                        title={`Last ${previous.type}: ${previous.name}`}
                    >
                        {/* Character Icon Background */}                        <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-200">
                            <Image
                                src={previous.imageUrl}
                                alt={previous.name}
                                fill
                                className="object-cover object-center"
                                sizes="80px"
                                loading="lazy"
                            />
                        </div>
                        
                        {/* Dark overlay for better text readability */}
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-200" />
                        
                        {/* Content - Only arrow icon */}
                        <div className="relative z-10 flex items-center justify-center">
                            <ChevronLeft className="h-10 w-10 text-red-400 group-hover:scale-110 transition-transform drop-shadow-lg" />
                        </div>
                    </Link>
                    
                    {/* Text content underneath button */}
                    <div className="text-center mt-2 px-1">
                        <p className="text-xs text-red-400 font-medium mb-1 drop-shadow-sm">LAST</p>
                        <p className="text-xs text-gray-200 leading-tight drop-shadow-sm break-words">
                            {previous.name}
                        </p>
                    </div>
                </div>
            )}

            {/* Next Button - Right Side Middle */}
            {next && (
                <div className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-50 flex-col items-center">
                    <Link
                        href={`/${next.type === 'killer' ? 'killers' : 'survivors'}/${next.id}`}
                        className="relative flex items-center justify-center w-20 h-32 bg-black/80 hover:bg-black/60 border-2 border-red-600 hover:border-red-400 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg backdrop-blur-sm group overflow-hidden"
                        title={`Next ${next.type}: ${next.name}`}
                    >
                        {/* Character Icon Background */}                        <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-200">
                            <Image
                                src={next.imageUrl}
                                alt={next.name}
                                fill
                                className="object-cover object-center"
                                sizes="80px"
                                loading="lazy"
                            />
                        </div>
                        
                        {/* Dark overlay for better text readability */}
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-200" />
                        
                        {/* Content - Only arrow icon */}
                        <div className="relative z-10 flex items-center justify-center">
                            <ChevronRight className="h-10 w-10 text-red-400 group-hover:scale-110 transition-transform drop-shadow-lg" />
                        </div>
                    </Link>
                    
                    {/* Text content underneath button */}
                    <div className="text-center mt-2 px-1">
                        <p className="text-xs text-red-400 font-medium mb-1 drop-shadow-sm">NEXT</p>
                        <p className="text-xs text-gray-200 leading-tight drop-shadow-sm break-words">
                            {next.name}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
