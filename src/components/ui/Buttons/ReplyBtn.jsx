import { CheckCircleIcon } from "@/components/icons";
import MessageCircle from "@/components/icons/MessageCircle";

const iconClassName = "h-16 w-16 stroke-[1.5px] lg:h-24 lg:w-24 lg:stroke-2";

const buttonClassName =
  "inline-flex items-center gap-x-[5px] rounded-md border border-red-400 bg-neutral-1 py-6 px-10 text-13 font-normal text-red-400 transition-colors hover:border-red-hover hover:text-red-hover lg:gap-x-[9px] lg:py-[11px] lg:pr-12 lg:pl-16 lg:text-16 lg:font-semibold";

export default function ReplySubmitCommentBtn({ type = "reply" }) {
  const isReply = type === "reply";

  return (
    <button type="button" className={buttonClassName}>
      {isReply ? (
        <MessageCircle className={iconClassName} />
      ) : (
        <CheckCircleIcon className={iconClassName} />
      )}
      <span>{type === "reply" ? "پاسخ" : "ثبت"}</span>
    </button>
  );
}
