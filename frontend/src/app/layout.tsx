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

// Critical CSS that loads before the main stylesheet
// Hide body until theme is determined to prevent flash
const criticalStyles = `
  html { background-color: #06070f; }
  body { visibility: hidden; }
  html.theme-ready body { visibility: visible; }
  html.light { background-color: #f8fafc; }
  html.light body { background-color: #f8fafc; }
  html.dark { background-color: #06070f; color-scheme: dark; }
  html.dark body { background-color: #06070f; color: #f1f5f9; }
`;

// Script to prevent flash of unstyled content (FOUC) for dark mode
// This runs before anything renders
const themeScript = `
(function() {
  var d = document.documentElement;
  try {
    var theme = localStorage.getItem('theme') || 'dark';
    d.classList.add(theme);
    if (theme === 'dark') {
      d.style.backgroundColor = '#06070f';
      d.style.colorScheme = 'dark';
    } else {
      d.style.backgroundColor = '#f8fafc';
    }
  } catch (e) {
    d.classList.add('dark');
  }
  d.classList.add('theme-ready');
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: criticalStyles }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
