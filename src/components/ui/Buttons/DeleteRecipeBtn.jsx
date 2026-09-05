import Trash from "@/components/icons/Trash";

const iconClassName =
  "h-22 w-22 stroke-[1px] md:h-24 md:w-24 md:stroke-[1.5px] lg:h-30 lg:w-30 lg:stroke-2";

const buttonClassName =
  "inline-flex items-center justify-center gap-x-8 rounded-[10px] border border-red-300 bg-transparent py-[9px] pr-10 pl-14 text-18 font-medium text-red-400 transition-colors hover:border-red-hover hover:text-red-hover md:gap-x-10 md:py-10 md:pr-14 md:pl-16 md:text-20 lg:py-12 lg:pr-16 lg:pl-18 lg:text-24";

export default function DeleteRecipeBtn() {
  return (
    <button type="button" className={buttonClassName}>
      <Trash className={iconClassName} />
      <span>حذف</span>
    </button>
  );
}
