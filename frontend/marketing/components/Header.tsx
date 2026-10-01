"use client";

const links = ["features", "pricing", "trust", "changelog", "careers"];

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4 md:px-8">
      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-slate-900/10 bg-[#fffdf8]/85 px-4 py-3 shadow-[0_10px_35px_rgba(36,31,27,.08)] backdrop-blur-xl md:px-5">
        <a className="flex items-center gap-2 font-semibold tracking-[-0.07em] text-slate-950" href="#top">
          <span className="grid size-8 place-items-center rounded-[11px] bg-slate-950 text-lg italic text-[#fff7ee]">r</span><span className="text-lg">recall</span>
        </a>
        <div className="hidden items-center gap-7 text-[.7rem] font-bold text-slate-500 lg:flex">
          {links.map((link) => <a className="transition hover:text-slate-950" href={`#${link}`} key={link}>{link}</a>)}
        </div>
        <a className="rounded-full bg-slate-950 px-4 py-2 text-[.68rem] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#ef7652]" href="#download">get started <span className="ml-1 text-[#ffb296]">↗</span></a>
      </nav>
    </header>
  );
}
