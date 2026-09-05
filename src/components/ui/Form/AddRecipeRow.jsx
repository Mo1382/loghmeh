import RemoveItemBtn from "@/components/ui/Buttons/RemoveItemBtn";
import ChevronDown from "@/components/icons/ChevronDown";
import SelectBar from "./SelectBar";

const labelClassName =
  "inline-block text-right text-15 font-medium text-neutral-8 lg:text-16";

const inputClassName =
  "px-14 py-12 w-full rounded-lg border border-neutral-5 bg-neutral-1 text-14 font-normal text-neutral-8 outline-none placeholder:text-neutral-6 focus:border-red-400 md:rounded-[10px] lg:px-16 lg:py-14 rounded-xl lg:text-16 lg:text-16 lg:font-regular placeholder:text-neutral-7 focus:border-red-400";

const errorClassName =
  "mt-14 block text-right text-12 font-normal text-red-400 md:mt-16 md:text-14 lg:mt-20";

function RecipeRowField({
  id,
  label,
  className,
  placeholder,
  type = "text",
  props,
}) {
  return (
    <div
      className={`inline-flex items-center grow gap-x-12 lg:gap-x-18 ${className}`}
    >
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        className={inputClassName}
        {...props}
      />
    </div>
  );
}

export default function AddRecipeRow({
  rowId = "ingredient-1",
  hasError = true,
  errorMsg = "اضافه کردن حداقل یک ماده اولیه الزامی است.",
}) {
  return (
    <div className="w-full">
      <div className=" flex flex-wrap items-start md:flex-nowrap gap-y-16! md:gap-y-0">
        <div className="hidden md:inline-block md:order-1 w-[44px] h-[44px] ml-18 lg:ml-24 rounded-[10px] bg-red-400 lg:w-[48px] lg:h-[48px]"></div>

        <div className="pl-16 md:pl-0 inline-flex order-1 md:order-2 md:ml-20 grow w-[calc(100%-50px)] md:order-2 md:w-auto">
          <RecipeRowField
            id={`${rowId}-name`}
            label="نام"
            placeholder="مثل گوجه، سیر یا ..."
            className="grow"
          />
        </div>

        <div className="order-3 flex gap-x-16 flex w-full md:w-auto">
          <div className="inline-flex min-w-0 self-start basis-1/2">
            <RecipeRowField
              id={`${rowId}-amount`}
              label="مقدار"
              placeholder="به ازای تعداد نفرات انتخابی"
              type="number"
              props={{ min: 1 }}
            />
          </div>

          <div className="inline-flex min-w-0 self-start basis-1/2">
            <SelectBar
              type="recipe"
              options={["گرم", "حبه", "عدد"]}
              name={`${rowId}-unit`}
              label="واحد"
              inputId={`${rowId}-unit`}
              initialValue="گرم"
            />
          </div>
        </div>

        <div className="order-2 md:order-4 md:mr-18 lg:mr-24">
          <RemoveItemBtn type="ingredient" />
        </div>
      </div>
      {hasError && <span className={errorClassName}>{errorMsg}</span>}
    </div>
  );
}
