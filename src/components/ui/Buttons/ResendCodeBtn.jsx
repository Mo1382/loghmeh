const className = "cursor-auto! transition-colors";

export default function ResendCodeBtn() {
  const isTimerFinished = false; // Replace with your actual logic to determine if the timer is finished

  return (
    <div className="flex items-center text-neutral-8 text-right font-light text-12 md:text-14 lg:text-16">
      <button
        type="button"
        className={`${className} ${isTimerFinished ? "cursor-pointer! text-red-500 hover:text-red-hover" : ""}`}
        disabled={!isTimerFinished}
      >
        ارسال مجدد کد
      </button>{" "}
      <span>:</span>
    </div>
  );
}
