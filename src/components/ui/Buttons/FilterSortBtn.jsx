import { FilterIcon } from "@/components/icons";
import SortIcon from "@/components/icons/FilterLines";

const buttonClassName =
  "rounded-md bg-red-50 py-6 pr-[11px] pl-[13px] border border-red-400 flex items-center gap-6 text-sm font-medium text-red-400 hover:text-red-hover transition-colors";
const iconClassName = "w-16 h-16";

export default function FilterSortBtn({ type = "filter", onOpen }) {
  const isFilter = type === "filter";

  return (
    <button className={buttonClassName} onClick={onOpen}>
      {isFilter ? (
        <FilterIcon className={iconClassName} />
      ) : (
        <SortIcon className={iconClassName} />
      )}
      <span className="text-13 font-medium">
        {isFilter ? "فیلتر" : "مرتب سازی"}
      </span>
    </button>
  );
}
