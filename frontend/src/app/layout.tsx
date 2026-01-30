import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
config.autoAddCss = false;

import type { Metadata } from "next";
import ClientShell from "./ClientShell";

export const metadata: Metadata = {
  title: "Alizè",
  description: "AI-powered job matching platform",
};

// Script to apply theme immediately - runs before page renders
const themeScript = `
(function() {
  var d = document.documentElement;
  var b = document.body;
  try {
    var theme = localStorage.getItem('theme') || 'dark';
    d.classList.add(theme);
    if (theme === 'dark') {
      d.style.backgroundColor = '#06070f';
      b.style.backgroundColor = '#06070f';
      d.style.colorScheme = 'dark';
    } else {
      d.style.backgroundColor = '#f8fafc';
      b.style.backgroundColor = '#f8fafc';
    }
  } catch (e) {
    d.classList.add('dark');
    d.style.backgroundColor = '#06070f';
    b.style.backgroundColor = '#06070f';
  }
  b.style.visibility = 'visible';
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" style={{ backgroundColor: '#06070f' }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body style={{ backgroundColor: '#06070f', visibility: 'hidden' }} suppressHydrationWarning>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
