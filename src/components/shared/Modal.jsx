import { AlertTriangleIcon } from "../icons";
import ModalCancelBtn from "../ui/Buttons/ModalCancelBtn";
import ModalConfirmBtn from "../ui/Buttons/ModalConfirmBtn";

export default function Modal({
  //   isOpen = false,
  isOpen = true,
  msg = "آیا از انجام این کار اطمینان دارید؟",
}) {
  if (!isOpen) return null;

  const bgClassName = `fixed flex justify-center items-center px-24 transition-opacity opacity-0 ${isOpen ? "opacity-100" : ""} right-0 left-0 top-0 bottom-0 bg-[#595959]/38 z-[2000]`;

  const windowClassname =
    "flex flex-col w-full md:w-[560px] lg:w-[630px] gap-y-[52px] md:gap-y-[60px] lg:gap-y-[66px] pt-40 px-24 pb-26 md:pt-[48px] md:px-30 md:pb-30 lg:pt-[52px] lg:px-40 lg:pb-38 bg-neutral-1 rounded-3xl md:rounded-[32px] lg:rounded-[36px] border border-neutral-3 shadow-modal";

  return (
    <div className={bgClassName}>
      <div className={windowClassname}>
        <div className="flex flex-col items-center gap-y-20 md:gap-y-26 lg:gap-y-32">
          <div className="flex justify-center w-[74px] h-[74px] md:w-[80px] md:h-[80px] lg:w-[92px] lg:h-[92px] items-center bg-red-400 rounded-full">
            <AlertTriangleIcon className="text-neutral-1 stroke-2 md:stroke-[2.5px] lg:stroke-[3px] md:w-38 lg:w-[47px] w-32 h-auto" />
          </div>
          <p className="text-16 font-medium text-neutral-7 leading-[204%] lg:text-18">
            {msg}
          </p>
        </div>
        <div className="flex flex-row justify-between">
          <ModalConfirmBtn />
          <ModalCancelBtn />
        </div>
      </div>
    </div>
  );
}
