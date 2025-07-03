"use client";

import { useState, useEffect } from "react";

export default function LensFlare() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    // Fixed positions for lens flares
    setPosition({
      x: window.innerWidth * 0.85,
      y: window.innerHeight * 0.15
    });
  }, []);
  
  return (
    <>
      <div 
        className="lens-flare" 
        style={{ 
          left: `${position.x}px`, 
          top: `${position.y}px`,
        }}
      />
      <div 
        className="lens-flare floating" 
        style={{ 
          left: `${position.x * 0.3}px`, 
          top: `${position.y * 0.5}px`,
          opacity: 0.05,
          width: "120px",
          height: "120px"
        }}
      />
    </>
  );
}