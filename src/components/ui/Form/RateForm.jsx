"use client";

import { useState } from "react";
import StarIcon from "@/components/icons/Star";
import SubmitRateBtn from "@/components/ui/Buttons/SubmitRateBtn";

const starClassName =
  "h-22 w-22 transition-colors duration-200 stroke-2 lg:h-32 lg:w-32 lg:stroke-2";

const titleClassName =
  "text-12 font-medium text-neutral-8 leading-[189%] mb-8 md:text-14 md:mb-14 lg:text-16";

// export default function RateForm({
//   hasError = true,
//   type = "recipe",
//   userRate ,
// }) {

export default function RateForm({ hasError = true, type = "recipe" }) {
  const [selectedStars, setSelectedStars] = useState(0);
  const stars = [1, 2, 3, 4, 5];

  const isNotification = type === "notification";

  const handleSelectStar = (star) => {
    setSelectedStars(selectedStars === star ? 0 : star);
  };

  const userRate = {
    rate: 3,
    updatedAt: "",
  };

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
        className={`flex gap-y-12 flex-col items-center md:gap-y-14 lg:gap-y-16 ${isNotification ? "flex-row gap-x-22 md:gap-x-30" : ""}`}
      >
        <div
          dir="ltr"
          className={`flex items-center gap-x-6 lg:gap-x-10  ${isNotification ? "order-2" : ""}`}
        >
          {stars.map((star) => {
            const isActive = selectedStars >= star;

            return (
              <button
                key={star}
                type="button"
                onClick={() => handleSelectStar(star)}
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
          {userRate && selectedStars === 0 ? (
            <p className="lg:mt-2 text-center text-10 md:text-11 lg:text-12 font-light text-neutral-8 leading-[189%] max-w-[270px] md:max-w-[210px] lg:max-w-[324px]">
              {/* Date must be calculated from updatedAt */}
              قبلا در تاریخ {"1404/11/03"} به این دستور پخت امتیاز{" "}
              {Math.round(userRate.rate)} از 5 داده‌اید.
            </p>
          ) : (
            <SubmitRateBtn />
          )}
        </div>
      </form>
    </div>
  );
}
