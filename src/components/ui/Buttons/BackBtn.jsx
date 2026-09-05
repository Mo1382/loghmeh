import ChevronRightIcon from "@/components/icons/ChevronRight";

const className =
  "inline-flex items-center border border-red-400 text-red-400 bg-neutral-1 transition-colors hover:border-red-hover hover:text-red-hover gap-x-2 rounded-[10px] py-10 pr-[9px] pl-[15px] text-15 font-medium  md:py-[11px] md:pr-10 md:pl-16 md:text-16 lg:text-19 lg:pr-10 lg:py-12 lg:pl-20";

const iconClassName =
  "h-20 w-20 md:h-[21px] md:w-[21px] lg:h-24 lg:w-24 stroke-2";

export default function BackBtn() {
  return (
    <button type="button" className={className}>
      <ChevronRightIcon className={iconClassName} />
      <span>بازگشت</span>
    </button>
  );
}
