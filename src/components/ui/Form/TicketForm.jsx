import SendTicketBtn from "../Buttons/SendTicketBtn";
import Avatar from "../Avatar";

const labelClassName =
  "mb-18 text-16 block font-semibold text-neutral-8 md:mb-20 md:text-20 lg:mb-26 lg:text-24";
const textClassName =
  "bg-neutral-1 rounded-2xl border border-neutral-5 w-full px-18 py-[15px] text-14 font-normal leading[140%] text-neutral-8 outline-none placeholder:text-neutral-6 focus:border-red-400 min-h-[170px] md:text-15 md:px-18 md:py-20 md:min-h-[162px]";
const errorClassName =
  "text-red-400 text-12 font-normal mt-12 md:text-14 md:mt-14";
const userInfoClassName = "hidden lg:flex flex-col items-center gap-y-12";

export default function TicketForm({
  hasError = true,
  errorMsg = "پیام ارسالی باید شامل حداقل یک کاراکتر باشد.",
  name = "ticket",
  inputId = "ticket-input",
}) {
  return (
    <form>
      <label className={labelClassName} htmlFor={inputId}>
        ارسال پیام به پشتیبانی
      </label>
      <div className="flex flex-col lg:flex-row gap-y-20 md:gap-y-24 lg:gap-x-40">
        <div className="lg:grow">
          <textarea
            id={inputId}
            placeholder="پیام خود را در این قسمت بنویسید ..."
            className={textClassName}
          ></textarea>
          {/* {hasError && <span className={errorClassName}>{errorMsg}</span>} */}
        </div>
        <div className="lg:flex lg:flex-col lg:justify-between">
          <div className={userInfoClassName}>
            <Avatar src="/test-avatar.png" className="w-[52px]" />
            <span className="text-15 font-medium text-neutral-8">
              علی صادقی
            </span>
          </div>
          <SendTicketBtn />
        </div>
      </div>
    </form>
  );
}
