import Image from "next/image";

export default function Avatar({ src, className }) {
  return (
    <div
      className={`
        ${className}
        relative rounded-full overflow-hidden aspect-square  
      `}
    >
      <Image
        src={src}
        alt="avatar"
        fill
        className="rounded-full object-cover"
      />
    </div>
  );
}
