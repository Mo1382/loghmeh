import { CloseIcon } from "@/components/icons";
import SearchIcon from "@/components/icons/Search";
import SeeAllResultsBtn from "@/components/ui/Buttons/SeeAllResultsBtn";
import SeeMoreBtn from "@/components/ui/Buttons/SeeMoreBtn";
import SearchRecipeCard from "@/components/ui/Cards/SearchRecipeCard";

export default function SearchBar({}) {
  // Fake data
  const searchQuery = "قرمه سب";
  const previewReults = [
    {
      name: "قرمه سبزی",
      category: "غذای اصلی",
      image: "/img/recipe.png",
      rate: 4.3,
    },
    {
      name: "خورشت سبزی",
      category: "غذای اصلی",
      image: "/img/recipe.png",
      rate: 4.3,
    },
    {
      name: "خورشت سبزی خوزستانی",
      category: "غذای اصلی",
      image: "/img/recipe.png",
      rate: 4.5,
    },
  ];

  return (
    <div className="relative">
      <div className="relative w-fit">
        <span className="cursor-pointer absolute right-0 top-0 right-12 md:right-16 bottom-0 flex items-center">
          <SearchIcon className="text-neutral-6 w-20 h-20 md:w-24 md:h-24  top-10 md:top-12" />
        </span>
        <input
          className="min-w-[220px] md:min-w-[272px] lg:min-w-[321px] md:rounded-2xl bg-neutral-1 outline border border-neutral-5 focus:border-red-400 focus:caret-red-400 rounded-xl py-10 md:py-12 text-13 md:text-16 font-regular pr-40 md:pr-[52px]"
          type="text"
          placeholder="جستجو ..."
        />
        {searchQuery && (
          <span className="cursor-pointer absolute flex items-center left-10 md:left-14 top-0 bottom-0">
            <CloseIcon className=" w-18 h-18 md:w-22 md:h-22 md:stroke-[1.5px] stroke-[1px] lg:stroke-2 text-neutral-7 hover:text-neutral-9 transition-colors" />
          </span>
        )}
      </div>

      <div className="absolute z-1000 top-[54px] md:top-[64px] w-[321px] lg:left-0 lg:right-0 lg:w-auto border border-neutral-5 rounded-2xl md:rounded-card">
        <ul>
          {previewReults.map((recipe, i, arr) => {
            let type;
            if (i + 1 === 1) type = "first";
            else if (i + 1 === arr.length) type = "last";
            else type = "middle";

            return <SearchRecipeCard key={i} recipe={recipe} type={type} />;
          })}
        </ul>

        <div className="cursor-pointer w-full text-center py-12 group md:py-10">
          <SeeAllResultsBtn />
        </div>
      </div>
    </div>
  );
}
