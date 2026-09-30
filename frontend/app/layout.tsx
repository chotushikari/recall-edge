import "./styles.css";
import type { ReactNode } from "react";

export const metadata = { title: "Recall Edge", description: "Private personal memory on Qdrant" };
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body><nav style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", padding: "1rem 2rem 0" }}><a href="/">Dashboard</a><a href="/sync/report">Sync report</a><a href="/conflicts">Conflicts</a></nav>{children}</body></html>; }
