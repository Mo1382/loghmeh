import CloseSquare from "@/components/icons/CloseSquare";

const className =
  "inline-flex items-center border border-red-400 text-red-400 bg-neutral-1 transition-colors hover:border-red-hover hover:text-red-hover gap-x-6 rounded-[10px] py-10 pr-12 pl-14 text-16 font-medium md:gap-x-[10px] md:py-12 md:pr-14 md:pl-20 md:text-19";

const iconClassName = "h-20 w-20 stroke-[1.5px] md:h-24 md:w-24 md:stroke-2";

export default function ModalCancelBtn() {
  return (
    <button type="button" className={className}>
      <CloseSquare className={iconClassName} />
      <span>لغو</span>
    </button>
  );
}
