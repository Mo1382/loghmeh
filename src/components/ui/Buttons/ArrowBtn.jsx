import ChevronLeft from "@/components/icons/ChevronLeft";
import ChevronRight from "@/components/icons/ChevronRight";

const iconClassName =
  "w-28  lg:w-36 lg:h-36 text-neutral-7 stroke-[3px] transition-colors group-hover:text-red-300";

export default function ArrowBtn({ type = "left" }) {
  return (
    <button
      className={`group flex justify-center items-center  w-[58px] h-[58px] lg:w-[76px] lg:h-[76px] rounded-full bg-neutral-3 hover:border-[1px] hover:border-red-300 transition-colors shadow-modal`}
    >
      {type === "left" ? (
        <ChevronLeft className={iconClassName} />
      ) : (
        <ChevronRight className={iconClassName} />
      )}
    </button>
  );
}
