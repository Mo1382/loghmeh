"use client";

import { useState } from "react";
import StarIcon from "@/components/icons/Star";
import SubmitRateBtn from "@/components/ui/Buttons/SubmitRateBtn";

const starClassName =
  "h-22 w-22 stroke-2 transition-colors duration-200 md:stroke-[2.5px] lg:h-34 lg:w-34 lg:stroke-[3px]";

const titleClassName =
  "text-12 font-medium text-neutral-8 leading-[189%] mb-8 md:text-14 md:mb-14 lg:text-16";

export default function RateForm({ hasError = true, type = "recipe" }) {
  const [selectedStars, setSelectedStars] = useState(0);
  const stars = [1, 2, 3, 4, 5];

  const isNotification = type === "notification";

  return (
    <div
      className={`w-full flex flex-col ${isNotification ? "lg:flex-row lg:justify-between" : ""}`}
    >
      {isNotification && (
        <h4 className={titleClassName}>
          امتیاز خود را در رابطه با پیگیری مشکل و نظرتان را با ما در ارتباط
          بگذارید.
        </h4>
      )}
      <form
        dir="ltr"
        className={`flex gap-y-12 flex-col items-center md:gap-y-14 lg:gap-y-16 ${isNotification ? "flex-row gap-x-22 md:gap-x-30" : ""}`}
      >
        <div
          className={`flex items-center gap-x-6 lg:gap-x-10  ${isNotification ? "order-2" : ""}`}
        >
          {stars.map((star) => {
            const isActive = selectedStars >= star;

            return (
              <button
                key={star}
                type="button"
                aria-label={`${star} ستاره`}
                onClick={() => setSelectedStars(star)}
                className={`rounded-full transition-colors ${
                  isActive
                    ? "text-yellow-500"
                    : "text-neutral-5 hover:text-yellow-500"
                }`}
              >
                <StarIcon filled={isActive} className={starClassName} />
              </button>
            );
          })}
        </div>

        <div className={isNotification ? "order-1" : ""}>
          <SubmitRateBtn />
        </div>
      </form>
    </div>
  );
}
