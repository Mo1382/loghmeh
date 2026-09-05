import Minus from "@/components/icons/Minus";

const typesClassName = {
  sm: "text-12 font-normal gap-x-4 rounded-md pr-8 pl-12 py-[5px] md:text-14 md:font-semibold md:rounded-lg md:pr-10 md:pl-14 md:py-6 lg:pr-8 lg:pl-14 lg:py-[7px]",
  lg: "text-14 font-semibold gap-x-4 rounded-md pr-8 pl-14 py-[7px] px-4 lg:text-16 gap-x-6 lg:py-8 lg:pr-12 lg:pl-16",
};

const iconsTypesClassName = {
  sm: "w-16 h-16 stroke-[1.5px] md:stroke-2 md:w-18 md:h-18 lg:w-20 lg:h-20",
  lg: "w-20 h-20 stroke-[2px] lg:w-22 lg:h-22",
};

export default function UnfollowBtn({ type = "lg" }) {
  return (
    <button
      className={`inline-flex items-center border border-red-400 text-red-400 transition-colors hover:border-red-hover hover:text-red-hover ${typesClassName[type]}`}
    >
      <Minus className={iconsTypesClassName[type]} />
      <span>دنبال نکن</span>
    </button>
  );
}
