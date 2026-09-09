"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

import ArrowBtn from "../ui/Buttons/ArrowBtn";
import RecipeCard from "../ui/Cards/RecipeCard";

export default function RecipeSlider({ recipes }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    direction: "rtl",
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
    loop: false,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const scrollPrev = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollNext();
  }, [emblaApi]);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;

    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    // updateButtons();

    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);

    return () => {
      emblaApi.off("select", updateButtons);
      emblaApi.off("reInit", updateButtons);
    };
  }, [emblaApi, updateButtons]);

  return (
    <section className="relative w-full">
      <div className="relative">
        {/* Prev */}
        <ArrowBtn
          type="right"
          onClick={scrollPrev}
          isDisabled={!canScrollPrev}
        />

        {/* Viewport */}
        <div ref={emblaRef} className="overflow-hidden">
          <div
            className="
              flex
              touch-pan-y
              gap-x-16 md:gap-x-24 lg:gap-x-32
            "
          >
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} isInHome={true} />
            ))}
          </div>
        </div>

        {/* Next */}
        <ArrowBtn
          type="left"
          onClick={scrollNext}
          isDisabled={!canScrollNext}
        />
      </div>
    </section>
  );
}
