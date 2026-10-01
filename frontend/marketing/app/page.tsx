import { CustomCursor } from "../components/CustomCursor";
import { Header } from "../components/Header";
import { Hero } from "../components/Hero";

const steps = [["01", "Observe", "Permitted screen and app context becomes evidence."], ["02", "Remember", "Time, context and local memory stay connected."], ["03", "Retrieve", "Ask about a moment and inspect why it matched."]];

export default function Page() {
  return <main>
    <CustomCursor /><Header /><Hero />
    <section id="features" className="statement"><p>Today’s computers execute commands.</p><h2>Recall keeps the <em>context</em> behind them.</h2></section>
    <section id="trust" className="feature-section"><div><p className="eyebrow">MEMORY WITH RECEIPTS</p><h2>When you remember<br />a fragment, find the <em>whole thread.</em></h2></div><div className="feature-window"><div className="window-bar"><i /><i /><i /><span>Recall / today</span></div><div className="window-body"><p>ASK YOUR COMPUTER</p><h3>“What did I do after opening VS Code?”</h3><div className="answer-card"><span>11:16 · Editor</span><b>Worked on the evidence retrieval path</b><small>12 linked events · view evidence →</small></div><div className="answer-card"><span>12:03 · Browser</span><b>Revisited the design brief</b><small>8 linked events · view evidence →</small></div></div></div></section>
    <section id="pricing" className="soft-grid"><div><p className="eyebrow">START WITH THE MEMORY LAYER</p><h2>Useful before<br />it becomes <em>intelligent.</em></h2></div><div className="soft-card"><span>◉</span><h3>Timeline, not time tracking</h3><p>See the sequence around your work rather than a vague count of open apps.</p></div><div className="soft-card coral"><span>✦</span><h3>Evidence over guesses</h3><p>Memory is useful only when you can trace it back to the source.</p></div></section>
    <section id="changelog" className="loop-section"><p className="eyebrow">THE RECALL LOOP</p><div className="loop-grid">{steps.map(([number, title, body]) => <article key={number}><span>{number}</span><div className="loop-mark">{number === "01" ? "◌" : number === "02" ? "✦" : "⌕"}</div><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section id="careers" className="trust-section"><div><p className="eyebrow">PRIVACY IS THE PRODUCT</p><h2>Your computer<br />should know <em>less</em> by default.</h2></div><ul><li><b>Explicit capture</b><span>Start, pause and stop are visible controls.</span></li><li><b>Local evidence</b><span>Raw activity is kept on-device by default.</span></li><li><b>Intentional removal</b><span>Retention pruning and full wipe controls are built in.</span></li></ul></section>
    <section id="download" className="download"><img src="/logo-mark.svg" alt="" /><p className="eyebrow">WINDOWS 10 / 11 PREVIEW</p><h2>Give your computer<br />a way <em>back.</em></h2><p>Open source, local-first and currently delivered as a source-based preview. A trusted signed installer is the next packaging milestone.</p><div><a className="pill-primary" href="https://github.com/chotushikari/recall-edge/archive/refs/heads/main.zip">download preview <span>↓</span></a><a className="download-link" href="https://github.com/chotushikari/recall-edge">view source ↗</a></div></section>
    <footer><b>recall</b><span>Independent open-source computer memory research.</span><span>Local-first · Evidence-grounded · Privacy-controlled</span></footer>
  </main>;
}
