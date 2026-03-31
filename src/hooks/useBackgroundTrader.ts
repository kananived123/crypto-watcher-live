import { useEffect, useRef } from "react";
import { useNewPairs } from "@/hooks/useNewPairs";
import { applyTradingCycle, loadProfileData, saveProfileData } from "@/lib/profileTrader";

export function useBackgroundTrader() {
  const { pairs } = useNewPairs(2000);
  const isRunning = useRef(false);

  useEffect(() => {
    if (!pairs.length || isRunning.current) return;

    let canceled = false;
    isRunning.current = true;

    async function runCycle() {
      try {
        const current = await loadProfileData();
        if (canceled) return;

        const { next, changed } = applyTradingCycle(current, pairs);
        if (!canceled && changed) {
          await saveProfileData(next);
        }
      } finally {
        if (!canceled) {
          isRunning.current = false;
        }
      }
    }

    runCycle();

    return () => {
      canceled = true;
      isRunning.current = false;
    };
  }, [pairs]);
}
