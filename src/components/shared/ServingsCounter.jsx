"use client";

import { useState } from "react";
import IncreaseDecreaseBtn from "../ui/Buttons/IncreaseDecreaseBtn";

export default function ServingsCounter({ defaultServings = 1 }) {
  const [servingsNum, setServingsNum] = useState(defaultServings);

  const handleIncrease = () => {
    setServingsNum((num) => num + 1);
  };

  const handleDecrease = () => {
    setServingsNum((num) => (num === 1 ? num : num - 1));
  };

  return (
    <div className="flex flex-row gap-x-12 md:gap-x-22 justify-center items-center">
      <IncreaseDecreaseBtn type="increase" onClick={handleIncrease} />
      <span className="text-13 text-center md:text-16 font-regular min-w-[40px] md:min-w-[46px] text-neutral-7">
        {servingsNum} نفر
      </span>
      <IncreaseDecreaseBtn type="decrease" onClick={handleDecrease} />
    </div>
  );
}
