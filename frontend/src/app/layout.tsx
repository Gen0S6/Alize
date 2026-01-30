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

// Script to prevent flash of unstyled content (FOUC) for dark mode
// This runs before anything renders
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.cssText = 'color-scheme: dark; background-color: #06070f;';
    }
  } catch (e) {}
})();
`;

// Critical CSS that loads before the main stylesheet
const criticalStyles = `
  html.dark { background-color: #06070f; color-scheme: dark; }
  html.dark body { background-color: #06070f; color: #f1f5f9; }
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
