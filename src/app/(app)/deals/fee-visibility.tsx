"use client";

import { useEffect, useState } from "react";
import type { Stage } from "@/domain/options";

/** Fee matters once the listing is won: Engaged through Closed. */
const FEE_STAGES: Stage[] = ["Engaged", "Marketing", "Awarded", "Under Contract", "Closed"];

/**
 * Shows the fee section from Engaged on. It stays visible whenever fee figures are
 * already entered, and it's hidden (not removed) otherwise, so saving never wipes them.
 */
export function FeeVisibility({
  initialStage,
  hasFeeData,
  children,
}: {
  initialStage: Stage;
  hasFeeData: boolean;
  children: React.ReactNode;
}) {
  // A stage picked in the form (not yet saved) wins until the saved stage changes,
  // e.g. after a move on the stage bar.
  const [picked, setPicked] = useState<{ base: Stage; value: Stage } | null>(null);
  useEffect(() => {
    const onChange = (e: Event) => setPicked({ base: initialStage, value: (e as CustomEvent<Stage>).detail });
    window.addEventListener("deal-stage-change", onChange);
    return () => window.removeEventListener("deal-stage-change", onChange);
  }, [initialStage]);
  const stage = picked && picked.base === initialStage ? picked.value : initialStage;
  return <div hidden={!(hasFeeData || FEE_STAGES.includes(stage))}>{children}</div>;
}
