"use client";

import NotificationBellIcon from "@/components/icons/NotificationBell";
import UserIcon from "@/components/icons/User";
import PhoneIcon from "@/components/icons/Phone";

const tabs = [
  {
    id: "support",
    label: "پشتیبانی",
    Icon: PhoneIcon,
  },
  {
    id: "notifications",
    label: "اعلانات",
    Icon: NotificationBellIcon,
  },
  {
    id: "profile",
    label: "پروفایل",
    Icon: UserIcon,
  },
];

export default function SettingTabs({ activeTab, onTabChange }) {
  return (
    <ul className="flex flex-row overflow-hidden h-[56px] md:h-[60px] lg:h-[64px] w-[364px] md:w-[440px] lg:w-[500px] rounded-t-xl border border-neutral-4 md:rounded-t-[20px] lg:rounded-t-3xl bg-neutral-1">
      {tabs.map((tab, i) => {
        const isActive = activeTab === tab.id;

        const isFirst = i === 0;
        const isLast = i === tabs.length - 1;
        const isMiddle = !isFirst && !isLast;

        return (
          <li
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
                flex
                relative
                group
                grow
                items-center
                justify-center
                gap-x-[7px]
                md:gap-x-8
                lg:gap-x-10
                cursor-pointer
                transition-colors
                ${isFirst ? "rounded-tr-xl rounded-tl-md rounded-bl-xl md:rounded-tr-[20px] md:rounded-tl-[10px] md:rounded-bl-[20px] lg:rounded-tr-3xl lg:rounded-tl-xl lg:rounded-bl-3xl" : ""}
                ${isLast ? "rounded-tr-md rounded-tl-xl rounded-br-xl md:rounded-tr-[10px] md:rounded-tl-[20px] md:rounded-br-[20px] lg:rounded-tr-xl lg:rounded-tl-3xl lg:rounded-br-3xl" : ""}  
                ${isMiddle ? "rounded-t-[14px] rounded-b-md md:rounded-t-2xl md:rounded-b-lg lg:rounded-t-[22px] lg:rounded-b-[14px]" : ""}
                ${isActive ? "bg-red-500 text-neutral-1" : "text-neutral-8"}
              `}
          >
            <tab.Icon
              className="
                  h-20
                  w-20
                  stroke-2
                  md:h-[21px]
                  md:w-[21px]
                  lg:w-[24px]
                  lg:h-[24px]
                "
            />

            <span className="text-14 md:text-15 lg:text-17 font-regular">
              {tab.label}
            </span>

            {!isActive && (
              <span className="absolute bottom-0 left-1/2 right-1/2 group-hover:opacity-100 group-hover:left-0 group-hover:right-0 transition-all duration-300 opacity-0 right-0 h-[1px] bg-red-500"></span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
