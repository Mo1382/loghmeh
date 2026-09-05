"use client";

import { useRef, useState } from "react";
import ProfileBtn from "../Buttons/ProfileBtn";
import { InstagramIcon } from "@/components/icons";

const logoClassName =
  "px-8 border-r border-neutral-5 h-full flex justify-center items-center lg:px-10";

const inputClassName =
  "w-full px-8 flex items-center text-left h-full outline-none text-neutral-8 placeholder:text-neutral-6 text-14 font-regular lg:text-15 lg:pl-10 lg:pr-12";

export default function SocialLinkForm({ hasError = false }) {
  const [isEditing, setIsEditing] = useState();
  const instaUserName = "aliMo82";
  const inputRef = useRef(null);

  return (
    <form className="group flex flex-row-reverse relative items-center w-[150px] h-[42px] rounded-lg bg-neutral-1 border border-neutral-5 has-[:focus]:border-red-400 md:rounded-[10px] md:w-[170px] lg:w-[180px] lg:h-[46px]">
      <span className={logoClassName}>
        <InstagramIcon className="h-26 w-26 text-neutral-7 stroke-[1px] group-has-[input:focus]:text-red-400" />
      </span>
      <input
        type="text"
        ref={inputRef}
        className={inputClassName}
        onFocus={() => {
          setIsEditing(true);
        }}
        onBlur={() => {
          setIsEditing(false);
        }}
      />
      <div className="absolute -right-10 -top-20 flex flex-row gap-x-8 lg:-top-28 lg:gap-x-6">
        {isEditing && (
          <>
            <ProfileBtn
              type="close"
              mediumSize="sm"
              onClick={() => inputRef.current?.blur()}
            />
            <ProfileBtn
              type="submit"
              mediumSize="sm"
              onClick={() => inputRef.current?.blur()}
            />
          </>
        )}
        {!isEditing && !instaUserName && (
          <ProfileBtn
            type="add"
            mediumSize="sm"
            onClick={() => inputRef.current?.focus()}
          />
        )}
        {!isEditing && instaUserName && (
          <>
            <ProfileBtn
              type="edit"
              mediumSize="sm"
              onClick={() => inputRef.current?.focus()}
            />
            <ProfileBtn
              type="remove"
              mediumSize="sm"
              onClick={() => inputRef.current?.focus()}
            />
          </>
        )}
      </div>
    </form>
  );
}
