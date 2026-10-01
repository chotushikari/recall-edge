import "./styles.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Recall — Local computer memory",
  description: "A local-first, evidence-grounded memory layer for your computer.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
