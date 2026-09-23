"use client";

import { useRef, useState } from "react";
import { ArrowLeftCircleIcon, CloseIcon, FilterIcon } from "../icons";
import FilterSortBtn from "../ui/Buttons/FilterSortBtn";
import ChevronLeftIcon from "../icons/ChevronLeft";
import DeleteFiltersBtn from "../ui/Buttons/DeleteFiltersBtn";
import FilterConfirmBtn from "../ui/Buttons/FilterConfirmBtn";
import Checkbox from "../ui/Checkbox";
import FilterSelectBar from "./FilterSelectBar";
import useClickOutside from "@/lib/hooks/useClickOutside";
import { DIFFICULTIES } from "@/constants/enums";

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
    options: DIFFICULTIES,
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

  const handleOpenFilter = (filterId) => {
    setOpenedFilterId((prev) => (prev === filterId ? null : filterId));
  };

  const filterRef = useRef(null);

  useClickOutside(filterRef, () => {
    setOpenedFilterId(null);
  });

  // Get already filtered items fron url parameters
  const filteredValues = ["غذای اصلی", "آسان", "ایران"];

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
              <CloseIcon
                className="w-22 h-22 stroke-2 cursor-pointer"
                onClose={handleCloseFilter}
              />
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
                <FilterConfirmBtn onCloseFilter={handleCloseFilter} />
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
                    // onClick={() => {}}
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
      <div className="hidden md:flex flex-row gap-x-24 relative lg:gap-x-32">
        <div className="flex flex-row items-start gap-x-8 text-neutral-8 pt-6 lg:gap-x-10 lg:pt-[7px]">
          <FilterIcon className="w-16 h-16 stroke-2 lg:w-18 lg:h-18" />
          <span className="text-14 font-regular lg:text-16 lg:font-medium">
            فیلترها
          </span>
        </div>
        <div className="flex flex-col gap-y-16 items-start grow">
          <ul className="flex flex-row gap-x-16 lg:gap-x-20" ref={filterRef}>
            {filterItems.map((item, i) => {
              return (
                <FilterSelectBar
                  key={i}
                  label={item.label}
                  options={item.options}
                  onOpenFilter={() => handleOpenFilter(item.id)}
                  isOpen={openedFilterId === item.id}
                />
              );
            })}
          </ul>
          <div className="w-full flex flex-row justify-between items-center">
            <ul className="flex flex-row py-[5px] gap-x-12 lg:gap-y-0">
              {filteredValues.map((value) => {
                return (
                  <li
                    className="bg-neutral-3 rounded-lg lg:rounded-[10px] border border-neutral-5 text-neutral-7 text-11 lg:text-12 font-medium py-[7] lg:py-8 px-10 lg:px-12"
                    key={value}
                  >
                    {value}
                  </li>
                );
              })}
            </ul>
            <div className="lg:absolute lg:left-0 lg:top-0">
              <DeleteFiltersBtn />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
