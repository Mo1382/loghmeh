"use client";

import { useState } from "react";
import RemoveItemBtn from "../ui/Buttons/RemoveItemBtn";
import { ChevronDownIcon, ChevronUpIcon } from "../icons";
import RateForm from "../ui/Form/RateForm";

const iconClassName = "w-22 h-22 stroke-2 text-neutral-8 md:w-28 md:h-28";

// export default function NotificationRow({notif}) {
export default function NotificationRow({}) {
  const notif = {
    createdTime: "",
    title: "کاربر “علی امینی” به دستور پخت “زرشک پلو با مرغ” شما امتیاز داد. ",
    description:
      " دستور پخت جدید اضافه شد! همین حالا طرز تهیه پاستای خامه‌ای ایتالیایی را مشاهده کنید و آن را در خانه امتحان کنید  دستور پخت جدید اضافه شد! همین حالا طرز تهیه پاستای خامه‌ای ایتالیایی را مشاهده کنید و آن را در خانه امتحان کنید",

    isRead: false,
    hasRating: true,
  };

  const [isOpen, setIsOpen] = useState(false);

  const toggleNotif = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="flex flex-row items-start gap-x-8 md:gap-x-20 lg:gap-x-22 w-full">
      <div
        className={`flex-flex-col pr-18 pl-20 py-16 md:pr-22 md:pl-22 md:py-20 lg:pr-26 lg:pl-26 lg:py-24 bg-neutral-1 grow rounded-xl md:rounded-[14px] lg:rounded-2xl border ${notif.isRead ? "border-neutral-5" : "border-red-200"} ${isOpen ? "gap-y-6 md:gap-y-10" : ""}`}
      >
        <div
          className="flex flex-row justify-between items-center cursor-pointer gap-x-18 md:gap-x-20 lg:gap-x-22"
          onClick={toggleNotif}
        >
          <h3 className="text-14 font-regular leading-[189%] text-neutral-8 md:text-15 lg:text-16">
            {notif.title}
          </h3>
          <div className="md:pl-10 lg:pl-14">
            {isOpen ? (
              <ChevronUpIcon className={iconClassName} />
            ) : (
              <ChevronDownIcon className={iconClassName} />
            )}
          </div>
        </div>
        {isOpen && (
          <div className="flex flex-col gap-y-16 md:gap-y-20 lg:gap-y-28">
            <div className="flex flex-row gap-x-22 md:gap-x-40 lg:gap-x-[50px]">
              <p className="text-11 font-light leading-[226%] md:text-12 md:leading-[211%] lg:text-14 lg:leading-[220%] text-neutral-8">
                {notif.description}
              </p>
              {/* Must be calculated from notif.createdTime */}
              <span className="self-end text-9 font-extralight leading-[152%] text-neutral-7 ">
                یک هفته پیش
              </span>
            </div>

            {notif.hasRating && (
              <div>
                <RateForm type="notification" />
              </div>
            )}
          </div>
        )}
      </div>
      <RemoveItemBtn className="shrink-0" type="notification" />
    </div>
  );
}
