import { ThumbsDownIcon, ThumbsUpIcon, TrashIcon } from "../icons";
import Avatar from "./Avatar";
import ReplySubmitCommentBtn from "./Buttons/ReplyBtn";

function ReactionBtn({
  type = "like",
  reactionCount = 0,
  hasUserLiked = false,
  isAuthenticated = false,
}) {
  const reactionIconClassName = `w-12 h-12 md:w-[15px] h-[15px] lg:w-18 lg:h-18 stroke-[1.5px] md:stroke-2 ${hasUserLiked ? "text-red-400" : ""} ${isAuthenticated ? "cursor-pointer" : ""}`;

  return (
    <div className="flex flex-row items-center gap-x-[5px] md:gap-x-[7px] lg:gap-x-8 text-neutral-7">
      <span className="pt-[1px] text-10 font-light md:text-12 lg:text-14">
        {reactionCount}
      </span>
      {type === "like" ? (
        <ThumbsUpIcon className={reactionIconClassName} />
      ) : (
        <ThumbsDownIcon className={reactionIconClassName} />
      )}
    </div>
  );
}

function RemoveBtn({}) {
  return (
    <button
      type="button"
      className="inline-flex items-center rounded-md border p-6 lg:p-[7px] lg:rounded-[10px] bg-neutral-1 transition-colors border border-red-400 text-red-400 hover:text-red-hover hover:border-red-hover"
    >
      <TrashIcon className="h-18 w-18 stroke-[1.5px] lg:w-20 lg:h-20 lg:stroke-2" />
    </button>
  );
}

export default function Comment({
  type = "comment",
  isUserComment = false,
  isUserRecipe = false,
}) {
  const comment = {
    text: "من نصف شکر رو با شکر قهوه‌ای جایگزین کردم و کمی گردو هم اضافه کردم. نتیجه خیلی خوش‌عطر و خوشمزه شد. فقط به نظرم ۲–۳ دقیقه کمتر در فر بمونه، بافتش نرم‌تر می‌شه.",
    createdTime: "",
    user: {
      username: "محمد سعادت",
      avatar: "/img/user.png",
      title: "کاربر عادی",
    },
    likeCount: 6,
    dislikeCount: 8,
  };

  const isReply = type === "reply";

  return (
    <div
      className={`relative bg-neutral-1 border border-neutral-3 ${isReply ? "w-auto mr-36 md:mr-[62px] lg:mr-[86px] bg-red-50 border-red-300" : "w-full"} flex flex-col gap-y-10 md:gap-y-12 rounded-[20px] md:rounded-3xl shadow-card px-16 py-18 md:px-20 md:py-22 lg:px-26 lg:py-28 ${isUserRecipe ? "pb-22 md:pb-26 lg:pb-34" : ""}`}
    >
      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-row items-center gap-x-8 md:gap-x-12 lg:gap-x-[15px]">
          <Avatar
            src={comment.user.avatar}
            className="w-[42px] h-[42px] md:w-[48px] md:h-[48px] lg:w-[62px] lg:h-[62px]"
          />
          <div className="flex flex-col gap-y-4 md:gap-y-[5px] lg:gap-y-10 text-neutral-8">
            <span className="font-medium text-12 md:text-14 lg:text-15">
              {comment.user.username}
            </span>
            <span className="font-light text-10 md:text-12 lg:text-1e">
              {comment.user.title}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-y-10 md:gap-y-8 lg:gap-y-12">
          <div className="flex flex-row gap-x-14 md:gap-x-16 lg:gap-x-18">
            <ReactionBtn type="like" reactionCount={comment.likeCount} />
            <ReactionBtn type="dislike" reactionCount={comment.dislikeCount} />
          </div>
          {/* Comment created time must be come form comment.CreatedTime and become UI friendly by a func */}
          <span className="font-light text-10 md:text-11 lg:text-12 text-neutral-7">
            دیروز
          </span>
        </div>
      </div>
      <p className="font-light text-11 leading-[189%] md:text-13 lg:text-15 text-neutral-8">
        {comment.text}
      </p>

      {isUserComment && (
        <div className="absolute left-16 -bottom-20 md:left-24 md:-bottom-16 lg:-bottom-12">
          <RemoveBtn />
        </div>
      )}

      {isUserRecipe && !isReply && (
        <div className="absolute right-16 -bottom-22 md:right-24 md:-bottom-20 lg:right-34 lg:-bottom-28">
          <ReplySubmitCommentBtn type="reply" />
        </div>
      )}
    </div>
  );
}
