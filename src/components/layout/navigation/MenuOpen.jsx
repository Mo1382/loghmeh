"use client";

import MenuIcon from "@/components/icons/Menu";
import { useMenu } from "./MenuContext";

export default function MenuOpen({}) {
  const { openMenu } = useMenu();

  return (
    <div onClick={openMenu}>
      <MenuIcon className="cursor-pointer hidden md:inline-block lg:hidden w-[48px] h-[48px] text-neutral-9" />
    </div>
  );
}
