"use client";

import { useEffect, useState } from "react";
import useMediaQuery from "@/lib/hooks/useMediaQuery";
import { UploadIcon } from "@/components/icons";
import Image from "next/image";

const errorClassName =
  "mt-10 block text-right text-12 font-normal text-red-500 md:mt-14 lg:text-14 lg:mt-16";

export default function RecipeUpload({
  inputId,
  errorMsg = "پر کردن این فیلد الزامی است.",
}) {
  const isTablet = useMediaQuery("(min-width: 768px)");
  const isError = false;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    setPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const uploadClassNameMobile =
    "inline-flex bg-neutral-1 rounded-md gap-x-6 text-14 font-regular text-red-400 pr-12 py-10 pl-14 border border-red-400";

  const uploadClassNameTablet = `flex justify-center items-center w-[298px] h-[298px] rounded-3xl bg-red-50 ${preview ? "" : "border border-red-300 border-dashed"} lg:w-[374px] lg:h-[374px]`;

  const uploadClassName = isTablet
    ? uploadClassNameTablet
    : uploadClassNameMobile;

  return (
    <div>
      <label className={`${uploadClassName} cursor-pointer!`} htmlFor={inputId}>
        {isTablet ? (
          preview ? (
            <div className="relative h-full w-full overflow-hidden rounded-3xl">
              <Image
                fill
                src={preview}
                alt="uploaded-picture"
                className="object-cover"
                unoptimized
              />
              <UploadIcon className="absolute left-20 top-18 lg:left-22 lg:top-20 text-red-400 stroke-2 w-[42px] h-[42px] lg:w-[48px] lg:h-[48px]" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <UploadIcon className="h-36 w-36 stroke-[1.5px] text-red-400 lg:h-12 lg:w-12 lg:stroke-2" />

              <span className="mt-16 mb-8 w-[192px] text-center text-12 font-light leading-[140%] text-neutral-7 lg:mt-18 lg:mb-10 lg:w-[216px] lg:text-14">
                تصویر دستور پخت را در این قسمت بارگذاری نمایید
              </span>

              <span className="w-fit text-center text-10 font-light text-neutral-7 lg:text-11">
                حجم تصویر نباید بزرگتر از 10 مگابایت باشد
              </span>
            </div>
          )
        ) : (
          <>
            <UploadIcon className="w-18 h-18 stroke-[1.5px]" />
            <span>بارگذاری تصویر{preview && " جدید"}</span>
          </>
        )}
      </label>
      <input
        id={inputId}
        type="file"
        className="hidden"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0] ?? null;
          setFile(selectedFile);
        }}
      />
      {isError && <span className={errorClassName}>{errorMsg}</span>}
    </div>
  );
}
