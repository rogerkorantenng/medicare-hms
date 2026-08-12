import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

/**
 * The four fonts are committed to public/fonts and served from this origin.
 * Nothing is fetched from Google at build time or at run time.
 *
 * This is deliberate. The handoff records that two v1.0 defects were caused
 * by unreachable external icon and image sources in the deployed build, which
 * is why the design uses an icon font and initials tiles in the first place.
 * Depending on fonts.googleapis.com at request time would reintroduce exactly
 * that failure mode.
 *
 * All three text faces are variable fonts, so one file per family covers the
 * whole weight range. Material Symbols is subsetted to the 65 icons this
 * application actually uses — 55 KB rather than the full 3 MB.
 */
const jakarta = localFont({
  src: '../public/fonts/jakarta.woff2',
  weight: '500 800', variable: '--font-jakarta', display: 'swap',
});
const inter = localFont({
  src: '../public/fonts/inter.woff2',
  weight: '400 700', variable: '--font-inter', display: 'swap',
});
const mono = localFont({
  src: '../public/fonts/mono.woff2',
  weight: '400 700', variable: '--font-mono', display: 'swap',
});

export const metadata: Metadata = {
  title: 'MediCare+ Hospital Management System',
  description:
    'Staff workspace and patient application for MediCare+ General Hospital.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1D4ED8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
