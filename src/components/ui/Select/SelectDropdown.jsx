"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import ChevronDown from "@/components/icons/ChevronDown";
import ChevronUp from "@/components/icons/ChevronUp";

/*
 * ============================================================================
 * Constants
 * ============================================================================
 */

const EMPTY_OPTIONS = [];

const baseTriggerClassName = `
  relative flex w-full items-center justify-between
  border border-neutral-5 bg-neutral-1
  text-right font-normal text-neutral-8
  outline-none transition-colors
  focus:border-red-400
  focus-visible:outline-2
  focus-visible:outline-offset-2
  focus-visible:outline-red-600
  disabled:cursor-not-allowed disabled:opacity-60
`;

const baseLabelClassName = `
  block text-right text-15 font-medium text-neutral-8
  md:text-16
`;

const baseMenuClassName = `
  absolute right-0 top-[calc(100%+16px)] z-30
  max-h-64 w-full overflow-y-auto
  border border-neutral-5 bg-neutral-1
  text-right font-normal text-neutral-8
  shadow-card
`;

const baseOptionClassName = `
  flex w-full items-center justify-between
  border-b border-neutral-4
  py-14 text-15
  transition-colors
  last:border-b-0
`;

const radioClassName = `
  flex h-22 w-22 shrink-0 items-center justify-center
  rounded-full border border-red-300 bg-red-50
`;

/*
 * ============================================================================
 * Helpers
 * ============================================================================
 */

function findFirstEnabledIndex(options) {
  return options.findIndex((option) => !option.disabled);
}

function findLastEnabledIndex(options) {
  for (let index = options.length - 1; index >= 0; index--) {
    if (!options[index].disabled) {
      return index;
    }
  }

  return -1;
}

function findNextEnabledIndex(options, currentIndex, direction) {
  if (options.length === 0) {
    return -1;
  }

  if (currentIndex < 0) {
    return direction > 0
      ? findFirstEnabledIndex(options)
      : findLastEnabledIndex(options);
  }

  for (let step = 1; step <= options.length; step++) {
    const index =
      (currentIndex + direction * step + options.length) % options.length;

    if (!options[index].disabled) {
      return index;
    }
  }

  return -1;
}

/*
 * ============================================================================
 * SelectDropdown
 * ============================================================================
 */

const SelectDropdown = forwardRef(function SelectDropdown(
  {
    id,
    name,
    label,
    options = EMPTY_OPTIONS,

    value,
    defaultValue,

    onChange,
    onBlur,

    placeholder = "انتخاب کنید",
    ariaLabel,

    disabled = false,
    required = false,
    error,

    layout = "stacked",
    size = "default",

    className = "",
    triggerClassName = "",
    menuClassName = "",
  },
  forwardedRef
) {
  /*
   * --------------------------------------------------------------------------
   * IDs and Refs
   * --------------------------------------------------------------------------
   */

  const generatedId = useId();

  const selectId = id ?? `select-${generatedId}`;
  const labelId = `${selectId}-label`;
  const listboxId = `${selectId}-listbox`;
  const errorId = `${selectId}-error`;

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const activeOptionRef = useRef(null);

  const setTriggerRef = useCallback(
    (node) => {
      triggerRef.current = node;

      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  /*
   * --------------------------------------------------------------------------
   * Options
   * --------------------------------------------------------------------------
   */

  const normalizedOptions = useMemo(
    () =>
      options.map((option) => {
        if (typeof option === "string") {
          return {
            value: option,
            label: option,
            disabled: false,
          };
        }

        return {
          value: option.value,
          label: option.label ?? String(option.value ?? ""),
          disabled: Boolean(option.disabled),
        };
      }),
    [options]
  );

  /*
   * --------------------------------------------------------------------------
   * Value Management
   * --------------------------------------------------------------------------
   */

  const isControlled = value !== undefined;

  const [internalValue, setInternalValue] = useState(defaultValue ?? "");

  const selectedValue = isControlled ? value : internalValue;

  const selectedIndex = normalizedOptions.findIndex((option) =>
    Object.is(option.value, selectedValue)
  );

  const selectedOption =
    selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null;

  /*
   * --------------------------------------------------------------------------
   * Dropdown State
   * --------------------------------------------------------------------------
   */

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  function openDropdown(direction = 1) {
    const selectedIsEnabled =
      selectedIndex >= 0 && !normalizedOptions[selectedIndex].disabled;

    const initialIndex = selectedIsEnabled
      ? selectedIndex
      : direction > 0
        ? findFirstEnabledIndex(normalizedOptions)
        : findLastEnabledIndex(normalizedOptions);

    setActiveIndex(initialIndex);
    setIsOpen(true);
  }

  function closeDropdown() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  /*
   * --------------------------------------------------------------------------
   * Option Selection
   * --------------------------------------------------------------------------
   */

  function handleSelect(option) {
    if (disabled || option.disabled) {
      return;
    }

    if (!isControlled) {
      setInternalValue(option.value);
    }

    onChange?.(option.value, option);

    closeDropdown();

    // Mark the field as touched when an option is selected.
    onBlur?.();

    triggerRef.current?.focus();
  }

  /*
   * --------------------------------------------------------------------------
   * Keyboard Navigation
   * --------------------------------------------------------------------------
   */

  function handleKeyDown(event) {
    const { key } = event;

    if (key === "Escape" && isOpen) {
      event.preventDefault();

      closeDropdown();

      triggerRef.current?.focus();

      return;
    }

    if (key === "Tab") {
      closeDropdown();
      return;
    }

    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();

      const direction = key === "ArrowDown" ? 1 : -1;

      if (!isOpen) {
        openDropdown(direction);
        return;
      }

      setActiveIndex((currentIndex) =>
        findNextEnabledIndex(normalizedOptions, currentIndex, direction)
      );

      return;
    }

    if (key === "Home" || key === "End") {
      event.preventDefault();

      if (!isOpen) {
        setIsOpen(true);
      }

      setActiveIndex(
        key === "Home"
          ? findFirstEnabledIndex(normalizedOptions)
          : findLastEnabledIndex(normalizedOptions)
      );

      return;
    }

    if (key === "Enter" || key === " ") {
      event.preventDefault();

      if (!isOpen) {
        openDropdown();
        return;
      }

      const activeOption = normalizedOptions[activeIndex];

      if (activeOption) {
        handleSelect(activeOption);
      }
    }
  }

  /*
   * --------------------------------------------------------------------------
   * Click Outside
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        closeDropdown();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  /*
   * --------------------------------------------------------------------------
   * Active Option Scrolling
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    if (isOpen) {
      activeOptionRef.current?.scrollIntoView?.({
        block: "nearest",
      });
    }
  }, [isOpen, activeIndex]);

  /*
   * --------------------------------------------------------------------------
   * Layout Classes
   * --------------------------------------------------------------------------
   */

  const triggerSizeClassName =
    size === "compact"
      ? "rounded-lg py-10 pl-10 pr-12 text-14"
      : `
          rounded-[10px] py-12 pl-12 pr-14 text-14
          md:rounded-[10px] md:px-16 md:text-15
          lg:text-16
        `;

  const labelSpacingClassName =
    layout === "inline" ? "shrink-0" : size === "compact" ? "mb-10" : "mb-12";

  const menuSizeClassName =
    size === "compact"
      ? "top-[calc(100%+10px)] rounded-2xl px-14 text-14"
      : "rounded-[24px] px-20 text-15";

  const optionSizeClassName = size === "compact" ? "py-12" : "py-14";

  const layoutClassName =
    layout === "inline"
      ? "flex w-full items-center gap-x-12"
      : "flex w-full flex-col";

  const fieldLayoutClassName =
    layout === "inline" ? "relative min-w-0 flex-1" : "relative w-full";

  const activeOption = normalizedOptions[activeIndex];

  return (
    <div ref={rootRef} dir="rtl" className={`${layoutClassName} ${className}`}>
      {/* Label */}

      {label && (
        <label
          id={labelId}
          htmlFor={selectId}
          className={`${baseLabelClassName} ${labelSpacingClassName}`}
        >
          {label}
        </label>
      )}

      <div className={fieldLayoutClassName}>
        {/* Trigger */}

        <button
          ref={setTriggerRef}
          id={selectId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && activeOption
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          aria-invalid={Boolean(error)}
          aria-required={required || undefined}
          aria-describedby={error ? errorId : undefined}
          aria-label={!label ? ariaLabel : undefined}
          disabled={disabled}
          onClick={() => {
            if (isOpen) {
              closeDropdown();
            } else {
              openDropdown();
            }
          }}
          onKeyDown={handleKeyDown}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget)) {
              closeDropdown();
            }

            onBlur?.(event);
          }}
          className={`
            ${baseTriggerClassName}
            ${triggerSizeClassName}
            ${error ? "border-red-500 focus:border-red-500" : ""}
            ${triggerClassName}
          `}
        >
          <span className={selectedOption ? "" : "text-neutral-6"}>
            {selectedOption?.label ?? placeholder}
          </span>

          {isOpen ? (
            <ChevronUp
              aria-hidden="true"
              className="absolute left-12 top-1/2 h-24 w-24 -translate-y-1/2"
            />
          ) : (
            <ChevronDown
              aria-hidden="true"
              className="absolute left-12 top-1/2 h-24 w-24 -translate-y-1/2"
            />
          )}
        </button>

        {/* Options */}

        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={label ? labelId : undefined}
          aria-label={!label ? ariaLabel : undefined}
          hidden={!isOpen}
          className={`${baseMenuClassName} ${menuSizeClassName} ${menuClassName}`}
        >
          {normalizedOptions.length === 0 ? (
            <li role="presentation" className="py-12 text-neutral-6">
              گزینه‌ای وجود ندارد.
            </li>
          ) : (
            normalizedOptions.map((option, index) => {
              const isSelected = Object.is(option.value, selectedValue);

              const isActive = index === activeIndex;

              return (
                <li
                  key={option.value}
                  ref={isActive ? activeOptionRef : null}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option)}
                  className={`
    ${baseOptionClassName}
    ${optionSizeClassName}
    ${option.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
  `}
                >
                  <span>{option.label}</span>

                  <span className={radioClassName}>
                    {isSelected && (
                      <span className="h-14 w-14 rounded-full bg-red-500" />
                    )}
                  </span>
                </li>
              );
            })
          )}
        </ul>

        {/* Hidden input for native FormData submission */}

        {name && (
          <input
            type="hidden"
            name={name}
            value={selectedValue ?? ""}
            disabled={disabled}
          />
        )}

        {/* Error Message */}

        {error && (
          <p
            id={errorId}
            role="alert"
            className="
              mt-10 block text-right
              text-12 font-normal text-red-500
              md:mt-12 md:text-14
            "
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
});

export default SelectDropdown;
