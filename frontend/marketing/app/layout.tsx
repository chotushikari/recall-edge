import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Recall — Your computer, with a memory",
  description: "A local-first memory layer for your personal computer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
