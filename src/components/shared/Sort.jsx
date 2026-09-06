"use client";

import useClickOutside from "@/lib/hooks/useClickOutside";
import { useRef, useState } from "react";
import { CloseIcon } from "../icons";
import SortIcon from "../icons/FilterLines";
import FilterSortBtn from "../ui/Buttons/FilterSortBtn";
import FilterSelectBar from "./FilterSelectBar";

const sortItems = [
  {
    id: "most-viewed",
    label: "پر بازدید ترین",
  },
  {
    id: "highest-rated",
    label: "بیشترین امتیاز",
  },
  {
    id: "newest",
    label: "جدید ترین",
  },
  {
    id: "oldest",
    label: "قدیمی ترین",
  },
];

export default function Sort() {
  const [isSortOpen, setIsSortOpen] = useState(false);
  // most-viewed / highest-rated / newest / oldest
  const [selectedSort, setSeletedSort] = useState(sortItems[0].id);

  const handleCloseSort = () => {
    setIsSortOpen(false);
  };

  const handleOpenSort = () => {
    setIsSortOpen(true);
  };

  const handleSelectSortOption = (sortId) => {
    setSeletedSort(sortId);
  };

  const sortRef = useRef(null);

  useClickOutside(sortRef, () => {
    handleCloseSort();
  });

  return (
    <>
      {/* Sort component for mobile screen */}
      <div className="inline-flex md:hidden">
        <FilterSortBtn type="sort" onOpen={handleOpenSort} />

        {isSortOpen && (
          <div
            ref={sortRef}
            className="fixed right-0 left-0 bottom-0 text-neutral-8 bg-neutral-1 flex flex-col pt-24 pb-14 px-20 border-t border-neutral-5 rounded-t-3xl"
          >
            <div className="border-b flex flex-row justify-between items-center border-neutral-5 pb-20">
              <div className="flex flex-row items-center gap-x-8">
                <SortIcon className="w-22 h-22 stroke-2" />
                <span className="text-18 font-regular">مرتب سازی</span>
              </div>
              <CloseIcon
                className="w-22 h-22 stroke-2 cursor-pointer"
                onClose={handleCloseSort}
              />
            </div>
            <ul className="mt-4 flex flex-col px-4">
              {sortItems.map((item, i) => {
                const isSelected = item.id === selectedSort;

                return (
                  <li
                    key={item.id}
                    onClick={() => handleSelectSortOption(item.id)}
                    className="cursor-pointer flex flex-row justify-between items-center py-22 border-b last:border-b-0 border-neutral-5"
                  >
                    <span className="text-16 font-regular">{item.label}</span>
                    <span className="flex h-22 w-22 items-center justify-center rounded-full border border-red-300 bg-red-50">
                      {isSelected ? (
                        <span className="h-14 w-14 rounded-full bg-red-500" />
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Sort component for tabelt and desktop screens */}
      <div className="hidden md:flex flex-row gap-x-24 lg:gap-x-32 items-center">
        <div className="flex flex-row items-start gap-x-8 text-neutral-8 lg:gap-x-10">
          <SortIcon className="w-16 h-16 stroke-2 lg:w-18 lg:h-18" />
          <span className="text-14 font-regular lg:text-16 lg:font-medium">
            مرتب سازی
          </span>
        </div>

        <ul className="flex flex-row gap-x-16 lg:gap-x-20">
          {sortItems.map((item, i) => {
            const isSelected = item.id === selectedSort;

            return (
              <li
                key={item.id}
                onClick={() => handleSelectSortOption(item.id)}
                className={`bg-neutral-1 border border-neutral-5 py-10 px-14 lg:py-[11px] lg:px-[15px] rounded-[10px] lg:rounded-xl text-12 lg:text-13 font-regular text-neutral-8 cursor-pointer transition-colors hover:border-red-400 ${isSelected ? "bg-red-500 text-neutral-1! border-0" : ""}`}
              >
                {item.label}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
