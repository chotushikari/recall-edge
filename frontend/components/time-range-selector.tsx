type Range = "today" | "yesterday" | "week" | "month";
type Props = { value: Range; onChange: (range: Range) => void };

export function TimeRangeSelector({ value, onChange }: Props) {
  return <div className="range-selector" aria-label="Timeline range">
    {(["today", "yesterday", "week", "month"] as Range[]).map((range) => (
      <button className={value === range ? "selected" : ""} key={range} onClick={() => onChange(range)}>{range}</button>
    ))}
  </div>;
}
