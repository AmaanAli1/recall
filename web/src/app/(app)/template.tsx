/**
 * App-wide page transition for Ask · Library · Dyno.
 *
 * A layout stays mounted when you move between its pages; a template is
 * re-created on every navigation. So this wrapper re-mounts each time and its
 * entrance animation (fade + rise, see .page-in in globals.css) replays, while
 * the header in layout.tsx stays still. Reads as "same app, new page".
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in flex flex-1 flex-col">{children}</div>;
}
