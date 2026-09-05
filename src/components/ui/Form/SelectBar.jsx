"use client";

import { useState } from "react";
import ChevronDown from "@/components/icons/ChevronDown";
import AuthSelectBarOption from "@/components/ui/Form/AuthSelectBarOption";
import ChevronUp from "@/components/icons/ChevronUp";

const errorClassName =
  "mt-10 pr-4 block text-right text-12 font-normal text-red-500 md:mt-12 md:pr-0 md:text-14";

export default function SelectBar({
  type = "auth",
  inputId,
  name,
  label = "عنوان کاربر",
  options,
  initialValue,
}) {
  const [selectedOption, setSelectedOption] = useState(initialValue || "");
  const [isOpen, setIsOpen] = useState(false);
  const isError = false;

  const isRecipe = type === "recipe";

  let inputClassName =
    "w-full caret-transparent rounded-[10px] border border-neutral-5 bg-neutral-1 pr-14 py-12 pl-12 text-14 font-normal text-neutral-8 outline-none focus:border-red-400 lg:text-16 md:rounded-[10px] md:pr-16";

  let chevronClassName =
    "absolute left-12 top-12 w-[21px] h-[21px] stroke-[1.5px] md:w-24 md:h-24 md:stroke-2";

  let listClassName =
    "absolute z-10 w-full rounded-2xl border border-neutral-5 bg-neutral-1 px-20 py-4 text-right text-15 font-normal text-neutral-8 outline-none md:rounded-3xl md:text-15";

  let labelClassName =
    "mb-12 block text-right text-15 font-medium text-neutral-8 md:text-16";

  if (isRecipe) {
    inputClassName += " rounded-lg";
    chevronClassName += " w-20 h-20 left-10 to-12";
    labelClassName += " mb-0!";
    listClassName += " right-[42px] w-[calc(100% - 42px)]! top-[60px]";
  }

  return (
    <div
      className={`w-full relative ${isRecipe ? "flex flex-row items-center gap-x-12" : ""}`}
    >
      <label className={labelClassName} htmlFor={inputId}>
        {label}
      </label>
      <div className={`relative mb-16 grow ${isRecipe ? "mb-0!" : ""}`}>
        <input
          type="text"
          name={name}
          id={inputId}
          value={selectedOption === "" ? "انتخاب کنید" : selectedOption}
          className={`${inputClassName} ${selectedOption === "" ? "text-neutral-6" : ""} ${isError ? "border-red-500" : ""}`}
          onClick={() => setIsOpen(!isOpen)}
          readOnly
        />
        {isOpen ? (
          <ChevronUp className={chevronClassName} />
        ) : (
          <ChevronDown className={chevronClassName} />
        )}
      </div>
      <ul
        style={{ width: "calc(100% - 42px)" }}
        className={`${listClassName} ${isOpen ? "block" : "hidden"} ${name === "recipe-category" ? "w-[226px]! md:w-[250px]! lg:w-[300px]! right-0" : ""}`}
      >
        {options.map((option, i) => (
          <AuthSelectBarOption
            key={option}
            option={option}
            isSelected={option === selectedOption}
            selectedOption={selectedOption}
            isLast={options.length === i + 1}
            onSelect={setSelectedOption}
            onClose={() => setIsOpen(false)}
          />
        ))}
      </ul>

      {isError && (
        <span className={errorClassName}>پر کردن این فیلد الزامی است.</span>
      )}
    </div>
  );
}
