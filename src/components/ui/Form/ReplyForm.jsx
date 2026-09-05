import ReplySubmitCommentBtn from "../Buttons/ReplyBtn";

const errorClassName = "text-13 font-regular text-red-400 lg:text-14";

const textareaClassName =
  "w-full min-h-[176px] rounded-3xl border border-neutral-5 bg-neutral-1 px-18 pt-16 pb-30 text-right text-14 font-normal leading-[189%] text-neutral-8 outline-none placeholder:text-neutral-6 focus:border-red-400 md:min-h-[122px] md:px-22 md:py-18 md:leading-[170%] lg:h-min-[118px]  lg:leading-[189%] lg:px-24 lg:text-16";

export default function ReplyForm({
  inputId = "add-comment-input",
  name = "comment",
  placeholder = "دیدگاه خود را درباره این دستور پخت اینجا بنویسید ...",
  errorMsg = "پر کردن این فیلد الزامی است.",
  hasError = false,
}) {
  return (
    <form className="w-full pr-36 md:pr-[62px] lg:pr-[86px] relative">
      <textarea
        id={inputId}
        name={name}
        placeholder={placeholder}
        className={`${textareaClassName}  mb-26 md:mb-28 lg:mb-38 ${hasError ? "border-red-500" : ""}`}
      ></textarea>
      <div className="pr-18 absolute top-[156px] md:pr-22 lg:pr-[42px] lg:top-[96px] md:top-[104px]">
        <ReplySubmitCommentBtn type="submit" />
      </div>
      {/* {hasError && <span className={errorClassName}>{errorMsg}</span>} */}
    </form>
  );
}
