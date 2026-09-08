import {
  ClockIcon,
  FilterIcon,
  LocationPinIcon,
  SpeedometerIcon,
} from "../icons";

const recipeDataList = [
  {
    // based on minutes
    id: "prepTime",
    label: "زمان آماده سازی",
    Icon: ClockIcon,
  },
  {
    // آسان / متوسط / سخت
    id: "difficulty",
    label: "درجه سختی",
    Icon: SpeedometerIcon,
  },
  {
    id: "calorieAmount",
    label: "مقدار کالری (Cal)",
    Icon: FilterIcon,
  },
  {
    id: "origin",
    label: "خاستگاه",
    Icon: LocationPinIcon,
  },
];

function RecipeMetadataBox({ item: { label, Icon }, value }) {
  return (
    <li className="flex w-1/4 h-[93px] md:h-[109px] lg:h-[112px] lg:py-12 flex-col grow items-center justify-center bg-neutral-3 border border-neutral-5 rounded-[10px] md:rounded-xl lg:rounded-[14px]">
      <Icon className="w-32 h-32 stroke-[1.5px] md:w-40 md:h-40 md:stroke-2 mb-8 md:mb-[9px]" />
      <span className="text-9 font-light mb-6 md:text-10 md:font-regular md:mb-[7px]">
        {label}
      </span>
      <span className="text-10 font-semibold md:text-12">{value}</span>
    </li>
  );
}

// export default function RecipeMetadata({ metadata }) {
export default function RecipeMetadata({}) {
  // Fake data
  const metadata = {
    prepTime: 50,
    difficulty: "آسان",
    calorieAmount: 300,
    origin: "فرانسه",
  };

  return (
    <ul className="flex flex-row w-full md:w-[424px] lg:w-full text-neutral-7 gap-x-16 md:gap-x-20 lg:gap-x-24">
      {recipeDataList.map((item) => {
        return (
          <RecipeMetadataBox
            key={item.id}
            item={item}
            value={metadata[item.id]}
          />
        );
      })}
    </ul>
  );
}
