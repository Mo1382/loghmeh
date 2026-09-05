import ChevronLeft from "@/components/icons/ChevronLeft";

export default function SeeAllResultsBtn({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-x-4 text-11 font-normal text-neutral-7 group-hover:text-neutral-9 transition-colors outline-none  duration-200 md:gap-x-4 md:text-12 md:font-semibold"
    >
      <span>مشاهده همه نتایج</span>
      <ChevronLeft className="h-16 w-16 stroke-2 md:h-18 md:w-18 group-hover:-translate-x-8 transition-all" />
    </button>
  );
}
