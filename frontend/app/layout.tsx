import "./styles.css";
import type { ReactNode } from "react";

export const metadata = { title: "Recall Edge", description: "Private personal memory on Qdrant" };
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
