"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api/transport";

export function useAuthCooldown() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(
      () => setSeconds((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const capture = useCallback((reason: unknown) => {
    if (
      reason instanceof ApiError &&
      reason.status === 429 &&
      reason.retryAfterSeconds
    ) {
      setSeconds(Math.max(1, Math.ceil(reason.retryAfterSeconds)));
    }
  }, []);

  return { cooldownSeconds: seconds, captureCooldown: capture };
}
