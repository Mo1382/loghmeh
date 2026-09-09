"use client";

import { notify } from "@/components/shared/Notification";

export default function Example() {
  return (
    <div>
      <button onClick={() => notify.success("دستور پخت با موفقیت ایجاد شد.")}>
        Success
      </button>

      <br />

      <button onClick={() => notify.error("خطایی رخ داد.")}>Error</button>
    </div>
  );
}
