"use client";

import toast from "react-hot-toast";
import { CheckmarkIcon, CloseIcon } from "../icons";
import AlertCircleIcon from "../icons/AlertCircle";

const statusIconClassName = "stroke-4 w-22 h-22";

export default function Notification({ t, type, message }) {
  const isSuccess = type === "success";

  return (
    <div
      className={`flex flex-row justify-between items-center text-neutral-1 rounded-xl md:rounded-[14px] shadow-card mx-auto min-w-[346px] max-w-[calc(100% - 48px)] md:max-w-[520px] pr-16 pl-14 py-14 ${isSuccess ? "bg-green-notif" : "bg-red-notif"} ${t.visible ? "animate-enter" : "animate-leave"}`}
    >
      <div className="flex flex-row justify-between items-center gap-x-12">
        {isSuccess ? (
          <CheckmarkIcon className={statusIconClassName} />
        ) : (
          <AlertCircleIcon className={statusIconClassName} />
        )}
        <p className="text-15 fint-regular">{message}</p>
      </div>
      <div className="px-4 py-4" onClick={() => toast.dismiss(t.id)}>
        <CloseIcon className="cursor-pointer w-22 h-22 stroke-[2.5px]" />
      </div>
    </div>
  );
}

function notifySuccess(message) {
  toast.custom((t) => <Notification t={t} type="success" message={message} />, {
    duration: 4000,
  });
}

function notifyError(message) {
  toast.custom((t) => <Notification t={t} type="error" message={message} />, {
    duration: 4000,
  });
}

export const notify = {
  success: notifySuccess,
  error: notifyError,
};
