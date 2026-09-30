"use client";

import { FormEvent, useState } from "react";

type Props = { api: string; onCreated: () => void };

export function QuickAddNote({ api, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (!note.trim()) return; await fetch(`${api}/memories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memory_type: "user", summary: note, embedding_text: note, provenance: { app_name: "Quick note" } }) }); setNote(""); setOpen(false); onCreated(); }
  return <>{<button onClick={() => setOpen(true)}>QUICK ADD NOTE</button>}{open && <div className="modal-backdrop"><form className="modal" onSubmit={submit}><p className="eyebrow">PRIVATE QUICK NOTE</p><textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} placeholder="What do you want to remember?" /><div><button type="button" onClick={() => setOpen(false)}>CANCEL</button><button type="submit">SAVE LOCALLY</button></div></form></div>}</>;
}
