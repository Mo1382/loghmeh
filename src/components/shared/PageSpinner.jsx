"use client";

import useMediaQuery from "@/lib/hooks/useMediaQuery";
import { SyncLoader } from "react-spinners";

export default function PageSpinner({ isLoading = true }) {
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1439px)");
  const isDesktop = useMediaQuery("(min-width: 1440px)");

  // Mobile
  let size = 14;
  let margin = 5;

  if (isTablet) {
    size = 15;
    margin = 6;
  }
  if (isDesktop) {
    size = 16;
    margin = 7;
  }

  return (
    <div className="mx-auto">
      <SyncLoader
        color="var(--color-red-500)"
        size={size}
        margin={margin}
        speedMultiplier={0.75}
        loading={isLoading}
      />
    </div>
  );
}
