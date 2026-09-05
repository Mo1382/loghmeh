import CheckboxChecked from "@/components/icons/CheckboxChecked";

const className =
  "bg-red-500 text-neutral-1 transition-colors hover:bg-red-hover inline-flex items-center gap-x-[7px] rounded-[10px] py-12 pr-8 pl-16 text-15 font-medium md:rounded-lg md:py-[11px] md:pr-12 md:text-16 lg:gap-x-10 lg:py-12 lg:pr-14 lg:pl-20 lg:text-19";

const iconClassName =
  "h-20 w-20 stroke-[1.5px] md:h-[21px] md:w-[21px] md:stroke-2 lg:h-24 lg:w-24";

export default function SignUpBtn() {
  return (
    <button type="button" className={className}>
      <CheckboxChecked className={iconClassName} />
      <span>ثبت نام</span>
    </button>
  );
}
