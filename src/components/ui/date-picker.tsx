import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseDateInputToISO } from "@/lib/date-utils";

export interface DatePickerProps {
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Visa även val av klockslag. */
  includeTime?: boolean;
  outputFormat?: "dd-mm-yyyy" | "yyyy-mm-dd" | "datetime-local" | "iso";
}

/** Tolkar valfritt datumformat till { date, time }. */
function parseValue(value: string): { date: Date | undefined; time: string } {
  const str = (value ?? "").trim();
  if (!str) return { date: undefined, time: "12:00" };

  let time = "12:00";
  let datePart = str;
  if (str.includes("T")) {
    const [d, t] = str.split("T");
    datePart = d;
    if (t) time = t.slice(0, 5);
  } else if (str.includes(" ")) {
    const [d, t] = str.split(" ");
    if (t && t.includes(":")) {
      datePart = d;
      time = t.slice(0, 5);
    }
  }

  const iso = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    ? datePart
    : parseDateInputToISO(datePart);

  if (iso) {
    const d = parseISO(`${iso}T${time}:00`);
    if (isValid(d)) return { date: d, time };
  }
  const direct = new Date(str);
  if (isValid(direct) && !isNaN(direct.getTime())) {
    return { date: direct, time: format(direct, "HH:mm") };
  }
  return { date: undefined, time };
}

export function DatePicker({
  value = "",
  onChange,
  placeholder = "Välj datum...",
  className,
  disabled = false,
  includeTime = false,
  outputFormat,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { date: selectedDate, time: selectedTime } = React.useMemo(
    () => parseValue(value),
    [value],
  );

  const emit = (d: Date | undefined, t: string) => {
    if (!d || !isValid(d)) {
      onChange?.("");
      return;
    }
    const choice = outputFormat ?? (includeTime ? "datetime-local" : "dd-mm-yyyy");
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    if (choice === "datetime-local") onChange?.(`${y}-${m}-${day}T${t}`);
    else if (choice === "yyyy-mm-dd") onChange?.(`${y}-${m}-${day}`);
    else if (choice === "iso") onChange?.(new Date(`${y}-${m}-${day}T${t}:00`).toISOString());
    else onChange?.(includeTime ? `${day}-${m}-${y} ${t}` : `${day}-${m}-${y}`);
  };

  const pickDate = (d: Date | undefined) => {
    if (!d) {
      onChange?.("");
      return;
    }
    emit(d, selectedTime);
    if (!includeTime) setOpen(false);
  };

  const label = selectedDate
    ? includeTime
      ? `${format(selectedDate, "d MMM yyyy", { locale: sv })} kl ${selectedTime}`
      : format(selectedDate, "dd-MM-yyyy")
    : "";

  const [hh, mm] = selectedTime.split(":");
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  const setToday = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    pickDate(d);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 rounded-xl font-normal",
            !label && "text-muted-foreground",
            className,
          )}
        >
          {includeTime ? (
            <Clock className="h-4 w-4 shrink-0" />
          ) : (
            <CalendarIcon className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{label || placeholder}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="pointer-events-auto z-50 w-auto max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-border/60 bg-popover p-0 shadow-2xl"
        align="start"
        sideOffset={6}
      >
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-3 py-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 rounded-full px-2.5 text-[11px]"
            onClick={() => setToday(0)}
          >
            Idag
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 rounded-full px-2.5 text-[11px]"
            onClick={() => setToday(1)}
          >
            Imorgon
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 rounded-full px-2.5 text-[11px]"
            onClick={() => setToday(7)}
          >
            +1 vecka
          </Button>
          {selectedDate && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 rounded-full px-2.5 text-[11px] text-destructive hover:bg-destructive/10"
              onClick={() => onChange?.("")}
            >
              <X className="mr-1 h-3 w-3" /> Rensa
            </Button>
          )}
        </div>

        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={pickDate}
          locale={sv}
          weekStartsOn={1}
          captionLayout="dropdown"
          startMonth={new Date(new Date().getFullYear() - 8, 0)}
          endMonth={new Date(new Date().getFullYear() + 8, 11)}
          className="bg-transparent p-3 [--cell-size:2.1rem]"
        />


        {includeTime && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Klockslag</span>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={hh ?? "12"}
                onChange={(e) => emit(selectedDate ?? new Date(), `${e.target.value}:${mm ?? "00"}`)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs tabular-nums"
                aria-label="Timme"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">:</span>
              <select
                value={mm ?? "00"}
                onChange={(e) => emit(selectedDate ?? new Date(), `${hh ?? "12"}:${e.target.value}`)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs tabular-nums"
                aria-label="Minut"
              >
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                className="h-8 rounded-lg px-3 text-[11px]"
                onClick={() => setOpen(false)}
              >
                Klar
              </Button>
            </div>
          </div>

        )}
      </PopoverContent>
    </Popover>
  );
}
