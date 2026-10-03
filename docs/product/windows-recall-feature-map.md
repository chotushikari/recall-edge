# Recall product and UX feature map

This is the product map for Recall's Windows desktop experience. It uses the
interaction lessons of Dayflow's work journal and Microsoft Recall's
privacy-first retrieval model without copying either product's code, name,
visual assets, or screen layouts.

## The product promise

Recall is a private work journal for Windows: it helps a person find a moment,
understand the work around it, and continue from that point. Evidence is local,
inspectable, and controllable.

## Shipped in the current desktop demo

| Experience | What the person can do |
| --- | --- |
| Timeline | Browse evidence-backed sessions by date and inspect the related app and window events. |
| Search / Ask Recall | Search saved local memories using natural-language phrasing. |
| Daily digest | See an on-device summary, top apps, and focus minutes. |
| Activity rhythm | Scan recent activity across a two-week heatmap. |
| Evidence preview | Review permitted visual frames only when visual capture was explicitly enabled. |
| Manual memory | Save an explicitly private or optional-sync note. |
| Capture controls | Start or stop context capture; separately confirm visual capture. |
| Retention and wipe | Prune local frames or permanently remove all local evidence with confirmation. |
| Sync boundary | Keep raw evidence local and selectively queue eligible semantic memory. |

## Microsoft Recall patterns to adapt

| Microsoft Recall capability | Recall UX decision |
| --- | --- |
| Opt-in snapshots and pause | Keep capture off by default; provide a persistent, unmistakable capture state and pause action. |
| Semantic text and image search | Make one search box the primary entry point, returning an evidence card with time, app, and source. |
| Timeline segments and preview | Group activity into readable sessions and allow a person to scrub visual evidence when it exists. |
| Resume from a prior moment | Add a future **Continue** action that opens the surviving source link or app context only with explicit user action. |
| App/site filters | Add a dedicated privacy screen for exclusions, with a visible record of what is excluded. |
| Per-item, app/site, and full deletion | Extend the existing full wipe with precise deletion controls and a clear impact preview. |
| Local encrypted data and identity gate | Keep data local; add Windows Hello protection before broad distribution rather than pretending it exists today. |
| Click to Do | Add an opt-in contextual action tray for copied text, links, and images; no actions leave the device unless chosen. |
| Personalized home | Show only useful “pick up where you left off” moments, with an option to turn personalization off. |

## Dayflow patterns to adapt

| Dayflow capability | Recall UX decision |
| --- | --- |
| Automatic timeline | Make the timeline the daily home, not a secondary analytics screen. |
| Daily standup | Turn the daily digest into editable highlights, priorities, and blockers. |
| Weekly review | Add focus, app distribution, and distraction trends as a separate review mode. |
| Chat with work journal | Keep Ask Recall grounded in local evidence and show sources beside every answer. |
| Exclusion and retention controls | Surface these controls before capture—not after a person has accumulated data. |
| Export | Add a future local Markdown export for a chosen date range. |

## Information architecture

```text
Home               Pick up where you left off + universal local search
Timeline           Day / week timeline, session preview, source evidence
Daily              Standup: highlights, priorities, blockers, digest
Weekly             Focus patterns, apps, distractions, review
Ask Recall         Grounded local answers with evidence citations
Privacy & data     Capture, exclusions, retention, deletion, sync boundary
Settings           Appearance, shortcuts, local model / provider choices
```

## Release guardrails

- Never imply that every Microsoft Recall feature is shipped.
- Keep capture opt-in and visibly pausable.
- Keep raw screenshots and events local by default.
- Require a confirmation before destructive actions or external actions.
- Use clear source evidence for every generated summary or answer.
