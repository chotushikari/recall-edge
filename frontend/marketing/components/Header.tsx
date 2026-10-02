"use client";

const links = ["vision", "product", "architecture", "privacy", "faq"];

export function Header() {
  return <header className="site-header"><nav className="site-nav">
    <a className="site-brand" href="#top"><span>r</span><b>recall</b></a>
    <div className="site-nav-links">{links.map((link) => <a href={`#${link}`} key={link}>{link}</a>)}</div>
    <a className="nav-cta" href="#download">Get started <span>&nearr;</span></a>
  </nav></header>;
}
