import Image from "next/image";
import logoLg from "@/../public/img/logo-large.png";
import logoMd from "@/../public/img/logo-med.png";
import Link from "next/link";

export default function Logo({ type = "lg", className }) {
  return (
    <Link className={className} href="/">
      <Image src={type === "lg" ? logoLg : logoMd} alt="logo" />
    </Link>
  );
}
