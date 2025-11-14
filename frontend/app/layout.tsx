import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlindVault",
  description: "Privacy-first analytics layer for financial institutions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-lg font-semibold tracking-tight">
                BlindVault
              </span>
            </div>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/"
                className="text-slate-300 hover:text-emerald-400 transition"
              >
                Home
              </Link>
              <Link
                href="/bank"
                className="text-slate-300 hover:text-emerald-400 transition"
              >
                Bank Dashboard
              </Link>
              <Link
                href="/user"
                className="text-slate-300 hover:text-emerald-400 transition"
              >
                User Insights
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>

        <footer className="border-t border-slate-800 bg-slate-950/80 mt-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} BlindVault</span>
            <span>“See less. Understand more.”</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
