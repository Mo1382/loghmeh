"use client";

export default function MenuBackLayer({ isMenuOpen, onCloseMenu }) {
  return (
    <div
      className={`transition-opacity hidden opacity-0 ${isMenuOpen ? "md:block opacity-100" : ""} lg:hidden absolute right-0 left-0 top-0 bottom-0 bg-[#595959]/38 z-[2000]`}
      onClick={onCloseMenu}
    ></div>
  );
}
