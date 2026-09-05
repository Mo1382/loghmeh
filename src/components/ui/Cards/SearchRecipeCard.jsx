import { StarIcon } from "@/components/icons";
import Image from "next/image";
import SeeMoreBtn from "../Buttons/SeeMoreBtn";

export default function SearchRecipeCard({ recipe, type = "middle" }) {
  const {
    name: recipeName,
    category: recipeCategory,
    image: recipeImg,
    rate: recipeRate,
  } = recipe;

  const wrapperClassName = `w-full group relative  px-16  md:px-12  lg:px-20   cursor-pointer ${type === "first" ? "rounded-t-2xl  md:rounded-t-card" : ""} bg-neutral-1`;
  // const deviderClassName =
  //   "after:absolute after:bottom-0 after:right-16 after:left-16 after:h-[1px] after:bg-neutral-5";

  return (
    <li className={wrapperClassName}>
      <div
        className={`flex flex-row justify-between items-end border-b border-b-neutral-5 pt-12 pb-[15px] md:pb-[11px] md:py-12 lg:py-16 ${type === "last" ? "pt-14" : ""} ${type === "first" ? "pt-18 md:pb-[13px] md:pt-16" : ""}`}
      >
        <div className="flex flex-row items-center gap-x-10 md:gap-x-12">
          <div className="relative w-[42px] overflow-hidden rounded-[10px] md:w-[48px] md:rounded-xl aspect-square">
            <Image
              className="object-contain"
              alt={recipeName}
              src={recipeImg}
              fill
            />
          </div>

          <div className="flex flex-col gap-y-[5px] md:gap-y-[7px]">
            <h4 className="text-12 font-medium text-neutral-8 md:text-13">
              {recipeName}
            </h4>
            <h6 className="text-9 font-light text-neutral-7 md:text-10">
              {recipeCategory}
            </h6>
          </div>
        </div>

        <div className="flex flex-col gap-y-8">
          {recipeRate && (
            <div className="flex flex-row-reverse gap-x-4 items-center">
              <StarIcon className="fill-yellow-400 text-yellow-400 w-12 h-12 md:w-[13px] md:h-[13px]" />
              <span className="text-10 font-regular md:text-11 md:font-medium text-neutral-7">
                {recipeRate}
              </span>
            </div>
          )}
          <SeeMoreBtn
            type="searchbarSee"
            iconClassNameUpdate="group-hover:-translate-x-6 md:group-hover:-translate-x-8 lg:group-hover:-translate-x-10 transition-transform duration-500"
          />
        </div>
      </div>
    </li>
  );
}
