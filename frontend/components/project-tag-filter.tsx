"use client";

import { useEffect, useState } from "react";

type Props = { api: string; active: string[]; onChange: (projects: string[]) => void };

export function ProjectTagFilter({ api, active, onChange }: Props) {
  const [projects, setProjects] = useState<string[]>([]);
  useEffect(() => { fetch(`${api}/projects`).then((response) => response.json()).then(setProjects).catch(() => setProjects([])); }, [api]);
  if (!projects.length) return null;
  return <section className="panel"><p className="eyebrow">PROJECTS</p><div className="chips">{projects.map((project) => <button className={active.includes(project) ? "selected" : ""} key={project} onClick={() => onChange(active.includes(project) ? active.filter((item) => item !== project) : [...active, project])}>{project}</button>)}</div></section>;
}
