"use client";

import { useRef, useState } from "react";
import ReplySubmitCommentBtn from "../Buttons/ReplyBtn";
import ProfileBtn from "../Buttons/ProfileBtn";

const errorClassName = "text-red-400 text-12 md:text-13 lg:text-14 font-normal";

const textareaClassName =
  "w-full rounded-2xl min-h-[248px] border border-neutral-5 bg-neutral-1 px-18 py-16 text-right text-13 font-normal leading-[205%] text-neutral-8 outline-none placeholder:text-neutral-6 focus:border-red-400 md:px-22 md:min-h-[167px] lg:px-24 lg:py-20 lg:rounded-[20px] lg:text-14 lg:min-h-[127px] lg:leading-[210%]";

export default function BioForm({
  hasError = false,
  errorMsg = "پر کردن این فیلد الزامی است.",
}) {
  const inputRef = useRef(null);

  const userBio = "";
  const [isEditing, setIsEditing] = useState(false);

  return (
    <form className="w-full relative">
      <textarea
        name=""
        id=""
        ref={inputRef}
        placeholder="در اینجا می‌توانید توضیحی در مورد خودتان بنویسید ..."
        className={`${textareaClassName} mb-14 lg:mb-16 ${hasError ? "border-red-500" : ""}`}
        defaultValue={userBio}
        onFocus={() => {
          setIsEditing(true);
        }}
        onBlur={() => {
          setIsEditing(false);
        }}
      ></textarea>
      <div className="flex flex-row absolute gap-x-8 left-16 top-[236px] md:top-[153px] lg:top-[105px]">
        {isEditing && (
          <>
            <ProfileBtn
              type="close"
              mediumSize="lg"
              onClick={() => {
                inputRef.current?.blur();
                setIsEditing(false);
              }}
            />
            <ProfileBtn
              type="submit"
              mediumSize="lg"
              onClick={() => inputRef.current?.blur()}
            />
          </>
        )}
        {!isEditing && !userBio && (
          <ProfileBtn
            type="add"
            mediumSize="lg"
            onClick={() => inputRef.current?.focus()}
          />
        )}
        {!isEditing && userBio && (
          <>
            <ProfileBtn
              type="edit"
              mediumSize="lg"
              onClick={() => inputRef.current?.focus()}
            />
            <ProfileBtn
              type="remove"
              mediumSize="lg"
              onClick={() => inputRef.current?.focus()}
            />
          </>
        )}
      </div>
      {/* {hasError && <span className={errorClassName}>{errorMsg}</span>} */}
    </form>
  );
}
