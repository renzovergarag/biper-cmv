"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface SelectedPlace {
  placeId: string;
  description: string;
  lat: number;
  lng: number;
  comuna: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: SelectedPlace) => void;
  onClearCoords?: () => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onClearCoords,
  placeholder = "Calle, número, comuna…",
  required,
  className,
  id,
}: Props) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const sessionToken = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36)),
    []
  );

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [empty, setEmpty] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  // Cerrar al click fuera
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Fetch al cambiar value
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = value.trim();
    if (trimmed.length < MIN_CHARS) {
      setSuggestions([]);
      setEmpty(false);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setEmpty(false);
      try {
        const res = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(trimmed)}&sessionToken=${sessionToken}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) {
          setSuggestions([]);
          setOpen(false);
          return;
        }
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions);
        setEmpty(data.suggestions.length === 0);
        setOpen(true);
        setHighlight(0);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, sessionToken]);

  async function handleSelect(s: Suggestion) {
    justSelectedRef.current = true;
    onChange(s.description);
    setOpen(false);
    setSuggestions([]);
    try {
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(s.placeId)}&sessionToken=${sessionToken}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as SelectedPlace & { description: string };
      onSelect({
        placeId: s.placeId,
        description: data.description || s.description,
        lat: data.lat,
        lng: data.lng,
        comuna: data.comuna,
      });
    } catch {
      // silencioso — fallback a texto libre
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          id={id ?? inputId}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (onClearCoords) onClearCoords();
          }}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && suggestions.length > 0 ? `${listboxId}-${highlight}` : undefined}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-auto"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex items-start gap-2 px-3 py-2 cursor-pointer min-h-12",
                i === highlight && "bg-accent"
              )}
            >
              <MapPin className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.mainText}</div>
                {s.secondaryText && (
                  <div className="truncate text-xs text-muted-foreground">{s.secondaryText}</div>
                )}
              </div>
            </li>
          ))}
          {empty && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Sin resultados — puedes dejarlo como texto libre
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
