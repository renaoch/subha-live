"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Check } from "lucide-react";

import { COUNTRIES, flagFromCode, type Country } from "@/lib/data/countries";

interface CountryPickerProps {
  open: boolean;
  value: string; // current country name
  onClose: () => void;
  onSelect: (country: Country) => void;
}

export function CountryPicker({
  open,
  value,
  onClose,
  onSelect,
}: CountryPickerProps) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setVisible(false);
      // Mount first, then flip the transition classes on next frame so the
      // sheet actually slides/fades in instead of snapping into place.
      const raf = requestAnimationFrame(() => setVisible(true));
      const id = setTimeout(() => inputRef.current?.focus(), 200);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(id);
      };
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close country picker"
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        className={`relative flex w-full max-w-md flex-col rounded-t-3xl border border-[#2A2238] bg-[#1D1829] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[#3A3050]" />

        <div className="flex items-center justify-between px-5 pt-3">
          <h2 className="text-base font-bold text-[#F3ECE0]">
            Select country
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9088A0] transition-colors hover:bg-[#2A2238] hover:text-[#F3ECE0]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-3 pt-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#2A2238] bg-[#17131F] px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-[#9088A0]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries..."
              className="w-full bg-transparent text-sm text-[#F3ECE0] placeholder:text-[#9088A0]/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto overscroll-contain px-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#9088A0]">
              No countries match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="pb-2">
              {filtered.map((country) => {
                const isSelected = country.name === value;
                return (
                  <li key={country.code}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(country);
                        onClose();
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? "bg-[#CBA35C]/10"
                          : "hover:bg-[#2A2238]/70 active:bg-[#2A2238]"
                      }`}
                    >
                      <span className="text-xl leading-none">
                        {flagFromCode(country.code)}
                      </span>
                      <span
                        className={`flex-1 text-sm ${
                          isSelected
                            ? "font-semibold text-[#CBA35C]"
                            : "text-[#F3ECE0]"
                        }`}
                      >
                        {country.name}
                      </span>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-[#CBA35C]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}