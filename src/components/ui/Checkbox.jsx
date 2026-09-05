"use client";

import { CheckmarkIcon } from "../icons";

export default function Checkbox({ isChecked = false, onChange, name, id }) {
  return (
    <>
      <label
        htmlFor={id}
        className={`inline-flex items-center justify-center cursor-pointer  h-22
          w-22 border
          border-red-300 bg-red-50 rounded-[6px] transition-colors
          duration-200 ${isChecked ? "border-0 bg-red-500" : ""}`}
      >
        {isChecked && (
          <CheckmarkIcon className="w-16 h-16 stroke-2 text-neutral-1" />
        )}
      </label>

      <input
        id={id}
        name={name}
        type="checkbox"
        checked={isChecked}
        onChange={(event) => onChange?.(event.target.checked)}
        className="hidden"
      />
    </>
  );
}
