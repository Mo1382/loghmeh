import Image from "next/image";
import {
  ArrowLeftCircleIcon,
  BookmarkOutlineIcon,
  StarIcon,
  UsersIcon,
} from "../icons";
import Avatar from "../ui/Avatar";
import RecipeMetadata from "../ui/RecipeMetadata";
import RecipeRate from "./RecipeRate";
import ServingsCounter from "./ServingsCounter";

function MobileActionBtn({ Icon, onClick }) {
  return (
    <button className="p-10 bg-neutral-1 rounded-full shadow-button">
      <Icon className="w-24 h-24 text-neutral-9 stroke-2" />
    </button>
  );
}

function RecipeBadge({ children: label }) {
  return (
    <span className="text-9 md:text-11 font-regular text-neutral-1 bg-neutral-6 rounded-md px-[7px] md:px-[9px] py-4 md:py-[5px]">
      {label}
    </span>
  );
}

// export default function RecipeDetailHeader({recipe}) {
export default function RecipeDetailHeader({ isBookmarked }) {
  // Fake data
  const recipe = {
    title: "کیک براونی شکلاتی",
    description:
      "براونی شکلاتی یک دسر کلاسیک آمریکایی است که بافتی متراکم، مرطوب و غنی از کاکائو دارد. خاستگاه آن به اواخر قرن نوزدهم در Chicago برمی‌گردد و به‌عنوان نسخه‌ای فشرده‌تر از کیک شکلاتی شناخته می‌شود. ترکیبات اصلی آن شامل شکلات یا پودر کاکائو، کره، شکر، تخم‌مرغ و مقدار کمی آرد است که باعث ایجاد بافتی بین کیک و فاج می شود.",
    img: "/img/chocolate-cake-with-chocolate-drops-cream.png",
    user: {
      username: "Ali_953",
      avatar: "/img/test-avatar.png",
      rate: 4.3,
      title: "کاربر عادی",
    },

    category: "دسر",
    rate: 4.8,
    rateNum: 120,
    defaultServings: 4,

    stats: {
      prepTime: 30, // Per min
      difficulty: "متوسط",
      calorieAmount: 250,
      origin: "ایران",
    },
  };

  return (
    <>
      {/* Recipe detail header in mobile screen */}
      <div className="flex flex-col md:hidden px-24">
        <div className="relative mb-22 -mx-24">
          <div className="relative w-full aspect-square">
            <Image
              src={recipe.img}
              fill
              className="object-contain"
              alt={recipe.title}
            />
          </div>

          <div className="absolute top-24 left-24 right-24 flex justify-between items-center">
            <MobileActionBtn Icon={BookmarkOutlineIcon} />
            <MobileActionBtn Icon={ArrowLeftCircleIcon} />
          </div>
          <div className="absolute left-24 -bottom-36 cursor-pointer">
            <Avatar src={recipe.user.avatar} className="w-[64px] h-[64px]" />
          </div>
        </div>

        <div className="flex flex-col gap-y-8 text-neutral-8 mb-20">
          <h2 className="max-w-[276px] text-22 font-semibold leading-[180%]">
            {recipe.title}
          </h2>
          <p className="text-14 font-light leading-[197%]">
            {recipe.description}
          </p>
        </div>

        <div className="flex flex-row justify-between items-center mb-30">
          <RecipeBadge>{recipe.category}</RecipeBadge>

          <RecipeRate avgRate={recipe.rate} rateNumber={recipe.rateNum} />
        </div>

        <div className="flex flex-col justify-center gap-y-[44px]">
          <RecipeMetadata />
          <ServingsCounter defaultServings={recipe.defaultServings} />
        </div>
      </div>

      {/* Recipe detail header in tablet screen */}
      <div className="hidden md:flex lg:hidden flex-col">
        <div className="relative flex flex-row justify-center gap-x-[60px] mb-[48px]">
          <div className="relative">
            <div className="relative w-[402px] aspect-square rounded-[48px] overflow-hidden">
              <Image
                src={recipe.img}
                alt={recipe.title}
                fill
                className="object-contain"
              />
            </div>
            <div className="absolute top-24 right-20 cursor-pointer">
              <BookmarkOutlineIcon className="w-[64px] h-[64px] stroke-[1.5px] text-red-400" />
            </div>
          </div>

          <div className="flex flex-col py-40">
            <div className="flex flex-row gap-x-16 items-center mb-40">
              <Avatar src={recipe.user.avatar} className="w-[90px] h-[90px]" />
              <div className="flex flex-col text-neutral-7">
                <span className="text-16 font-medium mb-6">
                  {recipe.user.username}
                </span>
                <span className="text-12 font-light mb-[15px]">
                  {recipe.user.title}
                </span>
                <div className="flex flex-row-reverse items-center gap-x-6">
                  <StarIcon
                    className="w-18 h-18 text-yellow-400"
                    filled={true}
                  />
                  <span className="text-14 font-regular">
                    {recipe.user.rate}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-24">
              <RecipeBadge>{recipe.category}</RecipeBadge>
            </div>

            <div>
              <RecipeRate avgRate={recipe.rate} rateNumber={recipe.rateNum} />
            </div>

            <div className="flex flex-row items-center gap-x-20 mt-auto">
              <UsersIcon className="w-[42px] h-[42px] text-neutral-8" />
              <ServingsCounter defaultServings={recipe.defaultServings} />
            </div>
          </div>

          <div className="absolute">
            <ArrowLeftCircleIcon className="" />
          </div>
        </div>

        <div className="flex flex-row justify-center mb-40">
          <RecipeMetadata />
        </div>

        <div className="flex flex-col gap-y-6">
          <h2 className="text-26 font-semibold leading-[180%] text-neutral-8">
            {recipe.title}
          </h2>
          <p className="text-15 font-light leading-[197%] text-neutral-9">
            {recipe.description}
          </p>
        </div>
      </div>

      {/* Recipe detail header in desktop screen */}
      <div className="hidden lg:flex"></div>
    </>
  );
}
