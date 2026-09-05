import RemoveItemBtn from "../Buttons/RemoveItemBtn";

const labelClassName =
  "text-15 font-normal text-neutral-8 md:text-16 lg:text-18";

const inputClassName =
  "text-14 font-normal rounded-xl text-neutral-8 placeholder:text-neutral-6 py-[13px] px-14 bg-neutral-1 outline-none border border-neutral-5 focus:border-red-400 md:px-18 md:py-14 md:text-15 md:leading-[200%] md:placeholder:font-light lg:text-17 lg:px-20 lg:py-16 lg:font-medium";

const errorClassName =
  "mt-14 block leading[170%] text-right text-12 font-normal text-red-400 md:text-14 lg:mt-16";

const textClassName =
  "text-12 font-light leading-[196%] rounded-xl text-neutral-8 placeholder:text-neutral-6 min-h-[116px] py-10 px-14 bg-neutral-1 outline-none border border-neutral-5 focus:border-red-400 md:text-14 md:font-normal leading-[204%] md:px-20 md:py-12 md:rounded-2xl md:min-h-[115px] lg:text-16 lg:leading-[200%] lg:py-14 lg:min-h-[92px]";

const numberClassName =
  "w-32 h-32 rounded-[10px] bg-red-400 text-neutral-1 text-15 font-medium flex justify-center items-start pt-6 after:content-[''] after:hidden md:after:inline-block after:absolute md:after:top-[66px] md:after:right-[26px] md:after:-bottom-[16px] md:after:w-[1.5px] md:after:bg-red-400 md:w-52 md:h-52 md:rounded-2xl md:pt-[11px] md:text-22 md:font-semibold lg:w-[48px] lg:h-[48px] lg:rounded-xl lg:text-20 lg:font-bold lg:pt-10 lg:after:top-[64px] lg:after:right-24 lg:after:-bottom-24";

function StepNumber({ step }) {
  return <div className={numberClassName}>{step}</div>;
}

export default function AddStepRow({
  rowId = "ingredient-1",
  hasError = true,
  errorMsg = "اضافه کردن حداقل یک ماده اولیه الزامی است.",
}) {
  return (
    <div className="relative flex flex-col md:flex-row md:gap-x-20 lg:gap-x-24">
      <StepNumber step="1" />
      <div className="absolute top-0 left-0 ">
        <RemoveItemBtn type="step" />
      </div>
      <div className="flex flex-col mt-18 md:mt-0 md:grow">
        <div className="mb-16 md:mb-18 flex flex-col md:flex-row gap-y-10 md:gap-y-0 md:gap-x-18 lg:gap-x-22">
          <label htmlFor="" className={labelClassName}>
            عنوان
          </label>
          <input
            type="text"
            className={`${inputClassName} md:w-[calc(100%_-_118px)] lg:w-[calc(100%_-_139px)]`}
            placeholder="عنوان این مرحله را در این قسمت بنویسید ..."
          />
        </div>
        <div className="flex flex-col md:flex-row gap-y-10 md:gap-y-0 md:gap-x-[25px] lg:gap-x-30">
          <label className={`${labelClassName} md:pt-10`} htmlFor="">
            شرح
          </label>
          <textarea
            name=""
            className={`${textClassName} md:w-full`}
            id=""
            placeholder="توضیحات مختصری از این مرحله را در این قسمت بنویسید ..."
          ></textarea>
        </div>
        {hasError && <span className={errorClassName}>{errorMsg}</span>}
      </div>
    </div>
  );
}
