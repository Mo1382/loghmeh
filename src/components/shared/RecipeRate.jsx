import { StarIcon } from "../icons";

export default function RecipeRate({ avgRate, rateNumber }) {
  if (rateNumber === 0)
    return (
      <p className="inline-flex text-10 md:text-12 font-light text-neutral-7">
        هنوز کاربری به این دستور پخت امتیاز نداده است.
      </p>
    );

  // avgRate always has to decimals
  const avgRateRounded = Math.round(avgRate * 10) / 10;
  const integeravgRateRounded = Math.round(avgRate);

  const arr = Array.from({ length: 5 });

  return (
    <div className="flex flex-row items-center gap-x-8 md:gap-x-14">
      <span className="font-extralight md:font-light text-9 md:text-11 text-neutral-7">
        ( <span className="font-light">{rateNumber}</span> نفر )
      </span>
      <div className="flex flex-row gap-x-6 items-start md:gap-x-8">
        <div dir="ltr" className="flex flex-row gap-x-[1px]">
          {arr.map((_, i) => {
            const isActive = i + 1 <= integeravgRateRounded;

            return (
              <button
                key={i}
                type="button"
                className="rounded-full cursor-auto!"
              >
                <StarIcon
                  filled={isActive}
                  className="h-16 w-16 stroke-2 md:h-20 md:w-20 text-yellow-400"
                />
              </button>
            );
          })}
        </div>
        <span className="text-11 font-regular text-neutral-7 pt-[1px] md:pt-2 md:text-14 md:font-medium">
          {avgRateRounded}
        </span>
      </div>
    </div>
  );
}
