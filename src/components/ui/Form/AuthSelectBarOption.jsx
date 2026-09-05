"use client";

const itemClassName =
  "w-(100%-42px) py-14 items-center justify-between border-b border-neutral-4 px-0 text-15 font-normal text-neutral-8";

const radioClassName =
  "flex h-22 w-22 items-center justify-center rounded-full border border-red-300 bg-red-50";

export default function AuthSelectBarOption({
  option,
  selectedOption,
  isSelected = false,
  isLast = false,
  onSelect,
  onClose,
}) {
  const handleSelect = () => {
    if (selectedOption !== option) {
      onSelect(option);
      onClose();
    }
  };

  return (
    <li
      className={`${itemClassName} ${isLast ? "border-b-0" : ""}`}
      onClick={handleSelect}
    >
      <div className="md:px-4 flex w-full items-center justify-between">
        <span>{option}</span>
        <span className={radioClassName}>
          {isSelected ? (
            <span className="h-14 w-14 rounded-full bg-red-500" />
          ) : null}
        </span>
      </div>
    </li>
  );
}
