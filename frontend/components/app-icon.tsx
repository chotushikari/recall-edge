type Props = { name: string };

export function AppIcon({ name }: Props) {
  const palette = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"];
  const color = palette[[...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % palette.length];
  return <span className="app-icon" style={{ backgroundColor: color }} aria-label={name}>{name.slice(0, 1).toUpperCase()}</span>;
}
