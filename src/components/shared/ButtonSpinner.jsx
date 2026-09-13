"use client";

import useMediaQuery from "@/lib/hooks/useMediaQuery";
import { PulseLoader } from "react-spinners";

export default function ButtonSpinner({ color = "var(--color-neutral-1)" }) {
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1439px)");
  const isDesktop = useMediaQuery("(min-width: 1440px)");

  // Mobile
  let size = 5;
  let margin = 2;

  if (isTablet) {
    size = 7;
    margin = 3;
  }
  if (isDesktop) {
    size = 9;
    margin = 4;
  }

  return (
    <div className="flex justify-center items-center absolute z-20 right-0 left-0 top-0 bottom-0 w-full h-full bg-inherit">
      <PulseLoader
        color={color}
        size={size}
        margin={margin}
        speedMultiplier={0.75}
        loading={true}
      />
    </div>
  );
}
