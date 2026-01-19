// ============================================================================
// MIRRORBODY-X : ROOT LAYOUT
// ============================================================================

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MirrorBody-X | Real-Time Pose-Synced Mirror Clone',
  description: 'Real-time camera-based system where a 3D mirror clone avatar perfectly copies your body movements',
  keywords: ['AR', 'pose tracking', 'MediaPipe', 'Three.js', 'WebGL', 'mirror effect'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
