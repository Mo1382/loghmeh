"use client";

import Checkbox from "../ui/Checkbox";

const itemClassName = "w-full py-14 border-b border-neutral-4";

export default function FilterSelectBarOption({ option, isLast = false }) {
  return (
    <li className={`${itemClassName} ${isLast ? "border-b-0" : ""}`}>
      <div className="px-6 lg:px-4 flex w-full items-center justify-between">
        <span className="text-13 font-regular lg:text-15 text-neutral-8">
          {option}
        </span>
        <Checkbox />
      </div>
    </li>
  );
}
