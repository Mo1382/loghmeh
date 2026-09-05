import ChevronLeft from "@/components/icons/ChevronLeft";

const types = {
  seeMoreMd: {
    label: "مشاهده",
    buttonClassName:
      "gap-x-2 lg:gap-x-4 text-11 font-semibold text-red-500 hover:text-red-hover lg:text-16 ",
    iconClassName: "w-12 h-12 color-red-500 stroke-[3px] lg:w-18 lg:h-18",
  },
  seeAll: {
    label: "مشاهده همه",
    buttonClassName:
      "gap-x-2 lg:gap-x-4 text-9 font-light text-neutral-7 hover:text-red-500 md:text-12 md:font-normal lg:text-16 lg:font-semibold",
    iconClassName:
      "w-12 h-12 color-neutral-7 stroke-2 md:w-[17px] md:h-[17px] lg:w-22 lg:h-22",
  },
  searchbarSee: {
    label: "مشاهده",
    buttonClassName:
      "gap-x-[1px] md:gap-x-2  text-12 md:text-13 font-normal text-red-400 hover:text-red-hover",
    iconClassName: "w-14 h-14 color-red-400 stroke-2",
  },
};

export default function SeeMoreBtn({
  type = "seeMoreMd",
  className,
  iconClassNameUpdate,
}) {
  const { label, buttonClassName, iconClassName } = types[type];

  return (
    <button
      className={`inline-flex w-fit items-center justify-center rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${buttonClassName} ${className}`}
    >
      <span>{label}</span>
      <ChevronLeft className={`${iconClassName} ${iconClassNameUpdate}`} />
    </button>
  );
}
