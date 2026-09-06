"use client";

import { useEffect } from "react";

export default function useClickOutside(ref, callback) {
  useEffect(() => {
    const handleMouseDown = (event) => {
      if (!ref.current) return;

      if (!ref.current.contains(event.target)) {
        callback(event);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [ref, callback]);
}
