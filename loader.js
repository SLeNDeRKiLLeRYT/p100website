// loader.js
'use client'

// This loader simply returns the original image URL from Supabase.
// It assumes you have already optimized the image before uploading.
export default function supabaseLoader({ src, width, quality }) {
  return src
}