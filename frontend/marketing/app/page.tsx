import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { MotionReveal } from "../components/MotionReveal";
import { ProductShowcase } from "../components/ProductShowcase";

const privacyPrinciples = [
  ["01", "Explicit capture", "Nothing begins without a clear choice. Start, pause, and stop are always visible."],
  ["02", "Local evidence", "Your raw activity stays on-device by default, with a local SQLite store and local search."],
  ["03", "Real removal", "Review retention, delete a moment, or wipe the memory layer completely when you choose."],
];

const questions = [
  ["Is Recall a screen recorder?", "No. Screens are only optional evidence. Recall is designed as a structured, temporal memory layer of events, context, and sources."],
  ["What can Recall remember?", "The Windows MVP can organize permitted screen context, active applications, window titles, browser context, timestamps, and local evidence."],
  ["Can I pause or remove my history?", "Yes. The product is built around visible capture controls, exclusions, retention settings, and deletion controls."],
  ["Does Recall send my computer history to the cloud?", "No permanent cloud dependency is required for the memory layer. Local storage and retrieval are the default architecture."],
];

export default function Page() {
  return <main>
    <Header />
    <Hero />
    <>
      <section className="proof-strip" aria-label="Recall product principles">
        <span>Local-first by default</span><i /> <span>Evidence-linked answers</span><i /> <span>Designed for Windows 10 and 11</span>
      </section>

      <MotionReveal><section id="vision" className="vision-band">
        <div data-reveal><p className="eyebrow">A DIFFERENT KIND OF COMPUTER HISTORY</p><h2>Your work is more than<br />the apps you had <em>open.</em></h2></div>
        <p data-reveal>Recall preserves the sequence around your work: the research that led to code, the tab that clarified the bug, and the evidence that makes a memory trustworthy.</p>
      </section></MotionReveal>

      <MotionReveal><ProductShowcase /></MotionReveal>

      <section id="architecture" className="architecture-section section-wrap">
        <div className="section-heading narrow" data-reveal><p className="eyebrow">THE RECALL LOOP</p><h2>From a permitted moment to a <em>useful memory.</em></h2></div>
        <div className="memory-pipeline" data-reveal>
          {[["Observe", "Screen, apps, browser, system events"], ["Organize", "Time, sessions, projects, evidence"], ["Retrieve", "Search, filters, semantic context"], ["Understand", "Grounded answers with sources"]].map(([title, body], index) => <article key={title}><span>0{index + 1}</span><div className={`pipeline-icon icon-${index}`} aria-hidden="true">{index === 0 ? "◌" : index === 1 ? "⌘" : index === 2 ? "⌕" : "✦"}</div><h3>{title}</h3><p>{body}</p></article>)}
        </div>
      </section>

      <MotionReveal><section id="privacy" className="privacy-section">
        <div className="section-wrap privacy-grid">
          <div data-reveal><p className="eyebrow">PRIVACY IS THE INTERFACE</p><h2>Your computer should remember <em>less</em> by default.</h2><p>Memory is only useful when it remains under the person&apos;s control. Recall makes capture, exclusions and deletion part of the experience, not a hidden setting.</p></div>
          <div className="privacy-orbit" aria-hidden="true" data-drift><div className="orbit-core"><span>your<br />memory</span></div><i className="privacy-chip chip-one">pause</i><i className="privacy-chip chip-two">exclude</i><i className="privacy-chip chip-three">delete</i></div>
        </div>
        <div className="privacy-principles section-wrap">{privacyPrinciples.map(([number, title, body]) => <article key={number} data-reveal><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section></MotionReveal>

      <section id="faq" className="faq-section section-wrap">
        <div data-reveal><p className="eyebrow">QUESTIONS, ANSWERED</p><h2>Start with the memory layer.</h2></div>
        <div className="faq-list" data-reveal>{questions.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
      </section>
    </>
    <section id="download" className="cta-section">
      <div className="cta-sun" aria-hidden="true" />
      <p className="eyebrow">WINDOWS 10 / 11 PREVIEW</p><h2>Give your computer<br />a way <em>back.</em></h2><p>Build from source today. The signed Windows installer is the next packaging milestone.</p>
      <div className="cta-actions"><a className="pill-primary" href="https://github.com/chotushikari/recall-edge/archive/refs/heads/main.zip">Download preview <span>&darr;</span></a><a className="text-link light" href="https://github.com/chotushikari/recall-edge">View the source <span>&nearr;</span></a></div>
    </section>
    <footer><a href="#top" className="footer-brand"><span>r</span> recall</a><span>Independent open-source computer memory research.</span><span>Local-first &middot; Evidence-grounded &middot; Privacy-controlled</span></footer>
  </main>;
}
