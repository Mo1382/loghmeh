import CheckCircle from "@/components/icons/CheckCircle";

const iconClassName =
  "h-22 w-22 stroke-[1.5px] md:h-24 md:w-24 md:stroke-2 lg:h-30 lg:w-30";

const className =
  "inline-flex items-center justify-center gap-x-8 rounded-lg bg-red-500 py-[9px] pr-14 pl-16 text-18 font-medium text-neutral-1 transition-colors hover:bg-red-hover md:gap-x-10 md:rounded-[10px] md:text-20 lg:gap-x-10 lg:py-12 lg:pr-16 lg:pl-18 lg:text-24 lg:font-semibold";

export default function AddEditRecipeBtn({ type = "add" }) {
  return (
    <button type="button" className={className}>
      <CheckCircle className={iconClassName} />
      <span>{type === "add" ? "ثبت" : "ویرایش"}</span>
    </button>
  );
}
