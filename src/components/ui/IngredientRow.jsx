import Image from "next/image";

// export default function IngredientRow({ ingredient, servingNumber }) {
export default function IngredientRow({ servingNumber }) {
  // Fake data instead of prop
  const ingredient = {
    name: "تخم مرغ",
    img: "/img/ingredient.png",
    // \er one serving
    amount: 500,
    unit: "گرم",
  };

  const totalAmount = ingredient.amount * servingNumber;

  return (
    <li className="flex flex-row w-full text-neutral-8 pr-16 py-10 pl-18 md:pr-14 md:pl-16 lg:pr-20 lg:py-12 lg:pl-24 justify-between items-center bg-neutral-1 border border-neutral-3 rounded-xl md:rounded-2xl lg:rounded-[20px] shadow-card">
      <div className="flex flex-row items-center gap-x-12 md:gap-x-16 lg:gap-x-18">
        <div className="relative w-32 h-32 md:w-[42px] md:h-[42px] lg:w-[52px] lg:h-[52px]">
          <Image
            className="object-contain rounded-full"
            fill
            src={ingredient.img || "/img/default-ingredient.png"}
            alt={ingredient.name}
          />
        </div>
        <span className="text-13 font-regular md:text-15 md:font-medium lg:text-18">
          {ingredient.name}
        </span>
      </div>

      <div className="flex flex-row items-center gap-x-10 lg:gap-x-12 text-13 font-regular md:text-15 md:font-medium lg:text-18">
        {ingredient.unit !== "به مقدار کافی" && <span>{totalAmount}</span>}
        <span>{ingredient.unit}</span>
      </div>
    </li>
  );
}
