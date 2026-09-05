import Avatar from "@/components/ui/Avatar";
import SubmitCommentBtn from "@/components/ui/Buttons/SubmitCommentBtn";

const textareaClassName =
  "w-full min-h-[126px] rounded-[18px] border border-neutral-5 bg-neutral-1 px-16 py-12 text-right text-12 font-normal leading-[140%] text-neutral-8 outline-none placeholder:text-neutral-6 focus:border-red-400 md:min-h-[118px] md:px-20 md:py-16 md:text-15 lg:rounded-3xl lg:px-22 lg:py-18 lg:text-16";

const errorClassName =
  "mt-12 block text-right text-11 font-normal text-red-400 md:mt-14 md:text-13 lg:mt-16 lg:text-14";

const userInfoClassName =
  "flex items-center lg:items-start gap-x-8 md:gap-x-14 lg:gap-x-20";

export default function AddCommentForm({
  inputId = "add-comment-input",
  name = "comment",
  placeholder = "دیدگاه خود را درباره این دستور پخت اینجا بنویسید ...",
  userName = "علی صادقی",
  userTitle = "کاربر عادی",
  errorMsg = "پر کردن این فیلد الزامی است.",
  hasError = true,
}) {
  return (
    <form className="w-full flex flex-col">
      <div className="flex items-end justify-between mb-16 md:mb-24 lg:mb-28">
        <div className={userInfoClassName}>
          <Avatar
            src="/test-avatar.png"
            className="w-[44px]  md:w-[64px]  lg:w-[86px]"
          />
          <div className="flex flex-col gap-y-[3px] md:gap-y-10 text-neutral-8 pt-12">
            <span className="text-12 font-regular md:text-14 lg:text-16 lg:font-medium">
              {userName}
            </span>
            <span className="text-10 font-light md:text-12 lg:text-14">
              {userTitle}
            </span>
          </div>
        </div>
        <SubmitCommentBtn />
      </div>

      <textarea
        id={inputId}
        name={name}
        placeholder={placeholder}
        className={textareaClassName}
      ></textarea>
      {hasError && <span className={errorClassName}>{errorMsg}</span>}
    </form>
  );
}
