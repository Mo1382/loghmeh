import { StarIcon } from "@/components/icons";
import Image from "next/image";
import CardFollowUnfollowBtn from "../Buttons/CardFollowUnfollowBtn";
import SeeMoreBtn from "../Buttons/SeeMoreBtn";

export default function CategoryCard({ isInHome = false }) {
  const categoryName = "صبحانه";
  const categoryImg = "/img/category.png";
  //   const categoryImg = "/img/category2.png";
  const categoryRecipesNumber = 18;

  const wrapperClassName = `group flex flex-row px-16 py-14 md:px-12 md:py-12 lg:px-20 lg:py-16 justify-center items-center h-[92px] md:h-[84px] lg:h-[116px] gap-x-14 md:gap-x-12 lg:gap-x-20 cursor-pointer border border-neutral-5 hover:border-red-400 rounded-2xl transition bg-neutral-1 w-1/2 ${isInHome ? "w-[154px] gap-x-12 h-[84px] px-12 py-12" : ""} md:w-1/4 lg:rounded-card`;

  return (
    <div className={wrapperClassName}>
      <div
        className={`relative w-[64px] ${isInHome ? "w-[60px]" : ""} md:w-[60px] lg:w-[84px] aspect-square`}
      >
        <Image
          className="object-contain"
          alt={categoryName}
          src={categoryImg}
          fill
        />
      </div>
      <div className="flex flex-col h-full justify-between items-start">
        <div>
          <h4 className="text-15 font-semibold text-neutral-8 mb-[2px] lg:text-20">
            {categoryName}
          </h4>
          <h6 className="text-9 font-light text-neutral-7 lg:text-12">
            {categoryRecipesNumber} دستور{" "}
            <span className="hidden md:inline-block">پخت</span>
          </h6>
        </div>

        <SeeMoreBtn iconClassNameUpdate="group-hover:-translate-x-8 md:group-hover:-translate-x-10 lg:group-hover:-translate-x-12 transition-transform duration-500" />
      </div>
    </div>
  );
}
