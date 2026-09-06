import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Gemini Reflection Journal',
  description: 'User-authenticated multi-turn reflection and journaling application powered by Gemini 3.6 Flash and Cloud Firestore.',
  openGraph: {
    title: 'Gemini Reflection Journal',
    description: 'User-authenticated multi-turn reflection and journaling application powered by Gemini 3.6 Flash and Cloud Firestore.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gemini Reflection Journal',
    description: 'User-authenticated multi-turn reflection and journaling application powered by Gemini 3.6 Flash and Cloud Firestore.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
