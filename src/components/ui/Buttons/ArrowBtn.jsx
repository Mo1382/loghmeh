import ChevronLeft from "@/components/icons/ChevronLeft";
import ChevronRight from "@/components/icons/ChevronRight";

const iconClassName =
  "w-28  lg:w-36 lg:h-36 text-neutral-7 stroke-[3px] transition-colors group-hover:text-red-300";

export default function ArrowBtn({ type = "left", onClick, isDisabled }) {
  const isRight = type === "right";
  return (
    <button
      className={`absolute
        ${isRight ? "-right-22 md:-right-22" : "-left-22 md:-left-22"}
            outline-none
            top-1/2
            -translate-y-1/2
            ${isDisabled ? "md:hidden" : "md:flex"}
            z-10 hidden group  disabled:opacity-40 justify-center items-center  w-[58px] h-[58px] lg:w-[76px] lg:h-[76px] rounded-full bg-neutral-3 border border-transparent hover:border-red-300 transition-colors shadow-modal`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {isRight ? (
        <ChevronRight className={iconClassName} />
      ) : (
        <ChevronLeft className={iconClassName} />
      )}
    </button>
  );
}
