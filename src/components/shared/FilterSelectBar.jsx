"use client";

import ChevronDown from "@/components/icons/ChevronDown";
import ChevronUp from "@/components/icons/ChevronUp";
import FilterSelectBarOption from "./FilterSelectBarOption";

const buttonClassName =
  "w-auto select-none pr-10 h-34 pl-34 lg:pr-12 lg:h-38 lg:pl-38 caret-transparent rounded-md lg:rounded-lg border border-neutral-5 bg-neutral-1 text-12 font-normal lg:text-13 text-neutral-8 outline-none";

const chevronClassName =
  "absolute left-10 top-[8.5px] w-16 h-16 lg:w-18 lg:h-18 lg:top-10 lg:left-12 stroke-2 cursor-pointer text-neutral-8";

const listClassName =
  "absolute z-10 w-[226px] lg:w-[251px] top-[48px] lg:top-[54px] rounded-[20px] lg:rounded-3xl border border-neutral-5 bg-neutral-1 px-14 lg:px-16 py-4";

export default function FilterSelectBar({
  label,
  options,
  onOpenFilter,
  isOpen = false,
}) {
  return (
    <li className="w-fit relative">
      <div className="relative grow select-none">
        <button className={buttonClassName} onClick={onOpenFilter}>
          {label}
        </button>
        {isOpen ? (
          <ChevronUp className={chevronClassName} />
        ) : (
          <ChevronDown className={chevronClassName} />
        )}
      </div>
      {isOpen && (
        <ul className={listClassName}>
          {options.map((option, i) => (
            <FilterSelectBarOption
              key={option}
              option={option}
              isLast={options.length === i + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
