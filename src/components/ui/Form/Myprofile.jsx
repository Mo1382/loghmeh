"use client";

import { useRef } from "react";
import Avatar from "../Avatar";
import ProfileBtn from "../Buttons/ProfileBtn";

export default function MyProfile({ inputId = "profile-upload" }) {
  const userProfilePic = "";

  const plusInputRef = useRef(null);
  const removeInputRef = useRef(null);
  const editInputRef = useRef(null);

  return (
    <form className="relative w-fit">
      <Avatar
        src={userProfilePic ? userProfilePic : "/img/default-profile.png"}
        className="w-[62px] md:w-[68px] lg:w-[78px] "
      />
      <div className="flex flex-row justify-between">
        {userProfilePic ? (
          <>
            <ProfileBtn
              type="edit"
              mediumSize="sm"
              className="absolute right-0 -bottom-20 md:-bottom-14 lg:-bottom-22"
              onClick={() => editInputRef.current?.click()}
            />
            <input
              id="edit-input"
              type="file"
              className="hidden"
              ref={editInputRef}
            />
            <ProfileBtn
              type="remove"
              mediumSize="sm"
              className="absolute left-0 -bottom-20 md:-bottom-14 lg:-bottom-22"
              onClick={() => removeInputRef.current?.click()}
            />
            <input
              id="remove-input"
              type="file"
              className="hidden"
              ref={removeInputRef}
            />
          </>
        ) : (
          <>
            <ProfileBtn
              type="add"
              mediumSize="sm"
              className="absolute right-0 -bottom-20 md:-bottom-14 lg:-bottom-22"
              onClick={() => plusInputRef.current?.click()}
            />
            <input
              id="plus-input"
              type="file"
              className="hidden"
              ref={plusInputRef}
            />
          </>
        )}
      </div>
    </form>
  );
}
