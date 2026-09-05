import Trash from "@/components/icons/Trash";

const className =
  "inline-flex items-center justify-center gap-x-8 rounded-md grow-1 border border-neutral-6 bg-neutral-1 text-neutral-7 h-[49px] text-16 font-medium transition-colors hover:border-red-hover hover:text-red-hover md:bg-neutral-1 md:border-red-400 md:text-red-400 md:gap-x-6 md:rounded-md md:py-10 md:pr-10 md:pl-12 md:text-13 lg:gap-x-[7px] lg:py-12 lg:pr-14 lg:pl-18 lg:text-14 font-semibold";

const iconClassName =
  "h-[19px] w-[19px] stroke-2 md:h-18 md:w-18 lg:h-20 lg:w-20";

export default function DeleteFiltersBtn() {
  return (
    <button type="button" aria-label="حذف فیلترها" className={className}>
      <Trash className={iconClassName} />
      <span>حذف فیلترها</span>
    </button>
  );
}
