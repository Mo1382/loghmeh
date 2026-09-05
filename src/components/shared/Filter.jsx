"use client";

import { useState } from "react";
import { ArrowLeftCircleIcon, CloseIcon, FilterIcon } from "../icons";
import FilterSortBtn from "../ui/Buttons/FilterSortBtn";
import ChevronLeftIcon from "../icons/ChevronLeft";
import DeleteFiltersBtn from "../ui/Buttons/DeleteFiltersBtn";
import FilterConfirmBtn from "../ui/Buttons/FilterConfirmBtn";
import Checkbox from "../ui/Checkbox";

const filterItems = [
  // Options must be fetched from the backend
  {
    id: "categories",
    label: "دسته بندی‌ها",
    options: ["همه", "پیش غذا", "غذای اصلی", "دسر"],
  },
  // Options must be fetched from the backend
  {
    id: "ingredients",
    label: "مواد اولیه",
    options: ["برنج", "روغن", "سیر", "پیاز"],
  },
  {
    id: "difficulties",
    label: "درجه سختی",
    options: ["آسان", "متوسط", "سخت"],
  },
  {
    id: "prepTime",
    label: "زمان آماده سازی",
    options: [
      "کمتر از 10 دقیقه",
      "10 تا 20 دقیقه",
      "20 تا 30 دقیقه",
      "30 تا 40 دقیقه",
      "40 تا 60 دقیقه",
      "بیشتر از 60 دقیقه",
    ],
  },
  // Options must be fetched from the backend
  {
    id: "origin",
    label: "خاستگاه",
    options: ["آمریکا", "ایتالیا", "چین", "هند", "ایران"],
  },
];

export default function Filter() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  // category, ingredients, difficulties, prepTime, origin
  const [openedFilterId, setOpenedFilterId] = useState(null);

  const openedFilter = filterItems.find((item) => item.id === openedFilterId);

  const handleCloseFilter = () => {
    setIsFilterOpen(false);
    setOpenedFilterId(null);
  };

  // Get already filtered items fron url parameters

  return (
    <>
      {/* Filter component for mobile screen */}
      <div className="inline-flex md:hidden">
        <FilterSortBtn type="filter" onOpen={() => setIsFilterOpen(true)} />

        {isFilterOpen && !openedFilterId && (
          <div className="absolute right-0 left-0 top-0 bottom-0 text-neutral-8 bg-neutral-1 flex flex-col py-26 px-20">
            <div className="border-b flex flex-row justify-between items-center border-neutral-5 pb-18">
              <div className="flex flex-row items-center gap-x-8">
                <FilterIcon className="w-22 h-22 stroke-2" />
                <span className="text-18 font-regular">فیلترها</span>
              </div>
              <CloseIcon className="w-22 h-22 stroke-2 cursor-pointer" />
            </div>
            <ul className="mt-4 flex flex-col px-4">
              {filterItems.map((item, i) => {
                return (
                  <li
                    key={item.id}
                    onClick={() => setOpenedFilterId(item.id)}
                    className="cursor-pointer flex flex-row justify-between items-center py-22 border-b last:border-b-0 border-neutral-5"
                  >
                    <span className="text-16 font-regular">{item.label}</span>
                    <ChevronLeftIcon className="w-24 h-24 stroke-2" />
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-row justify-between items-center mt-auto gap-x-32 px-4">
              <div className="flex w-1/2">
                <FilterConfirmBtn />
              </div>
              <div className="flex w-1/2">
                <DeleteFiltersBtn />
              </div>
            </div>
          </div>
        )}

        {isFilterOpen && openedFilterId && (
          <div className="absolute right-0 left-0 top-0 bottom-0 text-neutral-8 bg-neutral-1 flex flex-col py-26 px-20">
            <div className="flex flex-row justify-between items-center border-b border-neutral-5 pb-18">
              <span className="text-18 font-regular">{openedFilter.label}</span>
              <ArrowLeftCircleIcon
                className="w-26 h-26 stroke-2 cursor-pointer"
                onClick={() => setOpenedFilterId(null)}
              />
            </div>
            <ul className="mt-4 px-4 flex flex-col">
              {openedFilter.options.map((option, i) => {
                return (
                  <li
                    key={option}
                    // Must change filters parameter in URI
                    onClick={() => {}}
                    className="cursor-pointer flex flex-row justify-between items-center py-22 border-b border-neutral-5 last:border-b-0"
                  >
                    <span className="text-16 font-regular">{option}</span>
                    <Checkbox />
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-row justify-between items-center mt-auto gap-x-32 px-4">
              <FilterConfirmBtn type="lg" onCloseFilter={handleCloseFilter} />
            </div>
          </div>
        )}
      </div>

      {/* Filter component for tabelt and desktop screens */}
      <div className="hidden md:flex"></div>
    </>
  );
}
