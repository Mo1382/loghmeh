import Image from "next/image";
import errorIllustrator from "@/../public/img/error.png";

export default function AppError({
  errorMsg = "متاسفانه، برنامه با خطا مواجه شد.",
}) {
  return (
    <div className="w-fit flex flex-col gap-y-10 md:gap-y-14 lg:gap-y-16 items-center">
      <Image
        src={errorIllustrator}
        className="w-[192px] md:w-[274px] lg:w-[379px] h-auto"
        alt="error"
      />
      <span className="max-w-[260px] md:max-w-[290px] lg:max-w-[390px] text-red-300 text-14 font-extrabold leading-[189%] md:text-16 lg:text-18">
        {errorMsg}
      </span>
    </div>
  );
}
