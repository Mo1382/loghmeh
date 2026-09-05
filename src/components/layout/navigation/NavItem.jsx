import Link from "next/link";

export default function NavItem({
  type = "mobile",
  label,
  IconComponent,
  isActive = false,
}) {
  const navItemMobile = (
    <li className="flex-1 flex items-center justify-center">
      <Link
        href="#"
        className={`w-full flex flex-col cursor-pointer gap-y-[7px] justify-center items-center transition-all text-neutral-1  ${isActive ? "gap-y-[2px]" : ""}`}
      >
        <IconComponent
          className={`transition-all w-28 h-28 ${isActive ? "scale-[1.35]" : ""} stroke-2`}
        />
        <span
          className={`transition-all font-light text-11  ${isActive ? "font-regular text-12" : ""} text-center`}
        >
          {label}
        </span>
      </Link>
    </li>
  );
  const navItemTablet = (
    <li
      className={`group w-[234px] pr-14 rounded-xl duration-300 py-[13px] cursor-pointer border transition-colors border-transparent hover:border-red-400 ${isActive ? "border-0 bg-red-500" : ""}`}
    >
      <Link className="flex flex-row items-center gap-x-8" href="#">
        <IconComponent
          className={`w-24 h-24 transition-colors duration-300 ${isActive ? "text-neutral-1" : "text-neutral-9 group-hover:text-red-400"}`}
        />
        <span
          className={`text-16 transition-colors duration-300 font-regular ${isActive ? "font-medium text-neutral-1" : "text-neutral-9 group-hover:text-red-400"}`}
        >
          {label}
        </span>
      </Link>
    </li>
  );

  const view = type === "mobile" ? navItemMobile : navItemTablet;

  return view;
}
