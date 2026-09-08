import AlertCircleIcon from "../icons/AlertCircle";

export default function NotFound({ msg = "متاسفانه هیچ موردی پیدا نشد." }) {
  return (
    <div className="flex flex-col items-center gap-y-24 lg:gap-y-28 w-[332px] px-28 md:w-[414px] lg:w-[428px] lg:px-38 md:px-34 py-36 md:py-38 lg:py-40 rounded-2xl md:rounded-3xl lg:rounded-[28px]  bg-red-50 border border-red-300">
      <AlertCircleIcon className="text-red-300 w-[54px] h-[54px] stroke-2 md:w-[66px] md:h-[66px] lg:w-[81px] lg:h-[81px] " />
      <p className="text-neutral-8 text-13 font-light leading-[200%] md:text-15 md:leading-[205%] lg:text-16">
        {msg}
      </p>
    </div>
  );
}
