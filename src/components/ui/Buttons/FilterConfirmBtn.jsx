import CheckboxChecked from "@/components/icons/CheckboxChecked";

export default function FilterConfirmBtn({ type = "sm", onCloseFilter }) {
  const isSmall = type === "sm";

  const buttonClassName = `inline-flex items-center justify-center grow-1 bg-red-500 text-neutral-1 transition-colors bg-red-500 hover:bg-red-hover gap-x-10 ${isSmall ? "h-[49px] rounded-lg" : "h-[54px] rounded-xl"}`;

  const iconClassName = `stroke-2 ${isSmall ? "h-[21px] w-[21px]" : "w-24 h-24"}`;

  return (
    <button type="button" className={buttonClassName} onClick={onCloseFilter}>
      <CheckboxChecked className={iconClassName} />
      <span className="text-18  text-18 font-medium">تأیید</span>
    </button>
  );
}
