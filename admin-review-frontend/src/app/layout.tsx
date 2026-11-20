import type { Metadata } from "next";
import "./globals.css";
import "./midnight.css";
import Layout from "@/components/layout/Layout";
import ModalRoot from "@/components/modals/ModalRoot";
import LiveSupport from "@/components/support/LiveSupport";
import { Providers } from "./providers";
import "./game-surfaces.css";
import "./ui-polish.css";
import "./crimson.css";
export const metadata: Metadata = {
  title: {
    default: "GalaxyBets",
    template: "%s | GalaxyBets",
  },
  applicationName: "GalaxyBets",
  description: "GalaxyBets — cases, battles, and Originals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased dark galaxy-theme"
      >
        <Providers>
          <Layout>
            {children}
            <ModalRoot />
          </Layout>
        </Providers>
        <LiveSupport />
      </body>
    </html>
  );
}
