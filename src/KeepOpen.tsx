import { useEffect, useState, type ReactNode } from 'react';

/** Open a tool lazily, then retain its working state during sidebar navigation. */
export function KeepOpen({ active, children }: { active: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(active);
  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);
  return opened || active ? <div hidden={!active}>{children}</div> : null;
}
