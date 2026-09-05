import ChevronDown from "@/components/icons/ChevronDown";

const iconClassName = "h-18 w-18 stroke-[1.5px] md:h-20 md:w-20 lg:stroke-2";

const buttonClassName =
  "inline-flex items-center gap-x-4 rounded-md border border-red-400 bg-neutral-1 py-[11px] pr-10 pl-12 text-12 font-normal text-red-400 transition-colors hover:border-red-hover hover:text-red-hover md:py-12 md:text-13 md:font-medium lg:gap-x-[7px] lg:py-[13px] lg:pr-14 lg:pl-18 lg:text-14 lg:font-semibold";

export default function LoadMoreBtn() {
  return (
    <button type="button" className={buttonClassName}>
      <ChevronDown className={iconClassName} />
      <span>نمایش بیشتر</span>
    </button>
  );
}
