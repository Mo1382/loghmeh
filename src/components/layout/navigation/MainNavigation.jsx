"use client";

import { UserIcon } from "@/components/icons";
import AddCircleIcon from "@/components/icons/AddCircle";
import BookmarkIcon from "@/components/icons/Bookmark";
import CategoryGridIcon from "@/components/icons/CategoryGrid";
import CommunityIcon from "@/components/icons/Community";
import FoodIcon from "@/components/icons/Food";
import HomeIcon from "@/components/icons/Home";
import Logo from "@/components/ui/Logo";
import { useState } from "react";
import NavItem from "./NavItem";
import SignOutBtn from "@/components/ui/Buttons/SignOutBtn";
import MenuBackLayer from "./MenuBackLayer";
import { useMenu } from "./MenuContext";

const mobileNavItems = [
  {
    label: "خانه",
    Icon: HomeIcon,
  },
  {
    label: "دسته بندی",
    Icon: CategoryGridIcon,
  },
  {
    label: "دستور جدید",
    Icon: AddCircleIcon,
  },
  {
    label: "ذخیره‌ها",
    Icon: BookmarkIcon,
  },
  {
    label: "پروفایل",
    Icon: UserIcon,
  },
];

const tabletNavItems = [
  {
    label: "خانه",
    Icon: HomeIcon,
  },
  {
    label: "همه دستورها",
    Icon: FoodIcon,
  },
  {
    label: "دسته بندی‌ها",
    Icon: CategoryGridIcon,
  },
  {
    label: "ذخیره‌ها",
    Icon: BookmarkIcon,
  },
  {
    label: "جامعه لقمه",
    Icon: CommunityIcon,
  },
  {
    label: "دستور جدید",
    Icon: AddCircleIcon,
  },
];

export default function MainNavigation({}) {
  const { isMenuOpen, closeMenu } = useMenu();

  return (
    <>
      {/* Mobile navigation */}
      <nav className="md:hidden fixed z-[5000] bottom-16 right-16 left-16 px-20 h-[75px] rounded-3xl bg-[#8c8c8c]/95">
        <ul className="flex flex-row h-full">
          {mobileNavItems.map((item, i) => {
            // Fake data
            const isActive = i === 0 ? true : false;

            return (
              <NavItem
                key={item.label}
                type="mobile"
                label={item.label}
                IconComponent={item.Icon}
                isActive={isActive}
              />
            );
          })}
        </ul>
      </nav>

      {/* Tablet and desktop navigation */}
      <nav
        className={`hidden md:flex flex-col fixed bg-neutral-1 rounded-l-3xl bottom-0 top-0 -right-[300px] transition-all duration-500 ${isMenuOpen ? "right-0" : ""} w-[300px] pt-22 pb-32 pr-22 gap-y-10 z-[5000] lg:w-[320px] lg:static lg:h-screen lg:rounded-l-none border-l border-neutral-4
`}
      >
        <Logo />

        <ul className="flex flex-col gap-y-6">
          {tabletNavItems.map((item, i) => {
            // Fake data
            const isActive = i === 0 ? true : false;

            return (
              <NavItem
                key={item.label}
                type="desktop"
                label={item.label}
                IconComponent={item.Icon}
                isActive={isActive}
              />
            );
          })}
        </ul>

        <div className="mt-auto">
          <SignOutBtn />
        </div>
      </nav>

      {/* Show black layer when menu is open */}
      <MenuBackLayer isMenuOpen={isMenuOpen} onCloseMenu={closeMenu} />
    </>
  );
}
