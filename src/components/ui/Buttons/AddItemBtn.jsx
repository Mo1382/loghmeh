import Plus from "@/components/icons/Plus";

const iconClassName =
  "h-20 w-20 stroke-[1.5px] md:h-[21px] md:w-[21px] lg:h-24 lg:w-24 lg:stroke-2";

const baseClassName =
  "inline-flex items-center justify-center gap-x-6 rounded-md border border-red-400 bg-neutral-1 pr-10 py-[11px] pl-12 text-14 font-medium text-red-400 transition-colors hover:border-red-hover hover:text-red-hover md:gap-x-10 md:pr-12 md:py-10 md:pl-14 md:text-15 lg:gap-x-[9px] lg:py-[11px] lg:pl-16 lg:text-16 lg:font-semibold";

export default function AddItemBtn({ type = "ingredient" }) {
  const label =
    type === "ingredient"
      ? "اضافه کردن ماده اولیه جدید"
      : "اضافه کردن مرحله جدید";

  return (
    <button type="button" className={baseClassName}>
      <Plus className={iconClassName} />
      <span>{label}</span>
    </button>
  );
}
