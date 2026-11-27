import Image from "next/image";

export default function AuthDesktopIllustration() {
  return (
    <div
      className="
        fixed hidden
        shrink-0 overflow-hidden
        lg:block
        right-0 top-0 bottom-0
        w-1/2
      "
    >
      <Image
        src="/img/login-desktop.png"
        alt=""
        fill
        preload
        sizes="(min-width: 1440px) 50vw, 0px"
        className="object-cover"
      />
    </div>
  );
}
