import Link from "next/link";
import { FaDiscord, FaTwitter, FaTwitch, FaReddit } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="relative z-10 mt-auto py-8 border-t border-red-600/30">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <p className="text-lg mb-4 font-mono">Links to my social networks, if you wish to contact me about anything on this site:</p>

          <div className="flex gap-4 mb-2 justify-center">
            <Link
              href="https://discord.gg/GFPuzehJZs"
              target="_blank"
              className="transition-transform duration-300 ease-in-out hover:scale-125"
            >
              <FaDiscord size={40} className="text-[#5865F2]" />
            </Link>

            <Link
              href="https://x.com/SLeNDeR_KiLL3R"
              target="_blank"
              className="transition-transform duration-300 ease-in-out hover:scale-125"
            >
              <FaTwitter size={40} className="text-blue-400"/>
            </Link>
            
            <Link
              href="https://www.reddit.com/user/SLeNDeR_KiLLeR/"
              target="_blank"
              className="transition-transform duration-300 ease-in-out hover:scale-125"
            >
              <FaReddit size={40} className="text-orange-500" />
            </Link>
          </div>
          
          <p className="text-base text-gray-400 mt-2 font-mono font-bold">Psst! I also have a Twitch channel! Every follow is much appreciated, I mostly stream Dead By Daylight!</p>

          <Link
            href="https://www.twitch.tv/slender_kill3r"
            target="_blank"
            className="mt-2 inline-block transition-transform duration-300 ease-in-out hover:scale-125"
          >
            <FaTwitch size={40} className="text-purple-400" />
          </Link>
        </div>
      </div>
    </footer>
  );
}