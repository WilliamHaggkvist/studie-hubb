import * as React from "react";
import { format, parse, isValid, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseDateInputToISO, formatDateDDMMYYYY } from "@/lib/date-utils";

export interface DatePickerProps {
  value?: string; // dd-mm-yyyy or yyyy-mm-dd or ISO date string (or yyyy-mm-ddTHH:mm for datetime)
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /**
   * If true, includes time picker (hours and minutes)
   */
  includeTime?: boolean;
  /**
   * Target format for string output: 'dd-mm-yyyy' | 'yyyy-mm-dd' | 'iso' | 'datetime-local'
   * Defaults to 'dd-mm-yyyy' if includeTime is false, and 'datetime-local' (yyyy-MM-ddTHH:mm) if includeTime is true.
   */
  outputFormat?: "dd-mm-yyyy" | "yyyy-mm-dd" | "datetime-local" | "iso";
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
  const [inputValue, setInputValue] = React.useState(value);

  // Sync internal state when prop value changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Parse existing value string to a Date object & time string
  const { date: parsedDate, time: parsedTime } = React.useMemo(() => {
    if (!value) return { date: undefined, time: "12:00" };

    const str = value.trim();

    // Check if it includes time (e.g. YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm or dd-mm-yyyy HH:mm)
    let timePart = "12:00";
    let datePart = str;

    if (str.includes("T")) {
      const parts = str.split("T");
      datePart = parts[0];
      if (parts[1]) timePart = parts[1].slice(0, 5);
    } else if (str.includes(" ")) {
      const parts = str.split(" ");
      datePart = parts[0];
      if (parts[1] && parts[1].includes(":")) timePart = parts[1].slice(0, 5);
    }

    // Try parsing datePart
    let d: Date | undefined = undefined;

    // ISO or YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const iso = parseISO(`${datePart}T${timePart}:00`);
      if (isValid(iso)) d = iso;
    }
    // DD-MM-YYYY
    else if (/^\d{1,2}[-/. ]\d{1,2}[-/. ]\d{4}$/.test(datePart)) {
      const iso = parseDateInputToISO(datePart);
      if (iso) {
        const full = parseISO(`${iso}T${timePart}:00`);
        if (isValid(full)) d = full;
      }
    } else {
      const direct = new Date(str);
      if (isValid(direct)) d = direct;
    }

    return { date: d, time: timePart };
  }, [value]);

  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(parsedDate);
  const [selectedTime, setSelectedTime] = React.useState<string>(parsedTime);

  React.useEffect(() => {
    setSelectedDate(parsedDate);
    setSelectedTime(parsedTime);
  }, [parsedDate, parsedTime]);

  const formatOutput = (d: Date | undefined, t: string): string => {
    if (!d || !isValid(d)) return "";

    const formatChoice = outputFormat ?? (includeTime ? "datetime-local" : "dd-mm-yyyy");
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    if (formatChoice === "datetime-local") {
      return `${year}-${month}-${day}T${t}`;
    }
    if (formatChoice === "yyyy-mm-dd") {
      return `${year}-${month}-${day}`;
    }
    if (formatChoice === "iso") {
      return new Date(`${year}-${month}-${day}T${t}:00`).toISOString();
    }
    // Default dd-mm-yyyy
    if (includeTime) {
      return `${day}-${month}-${year} ${t}`;
    }
    return `${day}-${month}-${year}`;
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (!date) {
      setInputValue("");
      onChange?.("");
      return;
    }

    const formatted = formatOutput(date, selectedTime);
    setInputValue(formatted);
    onChange?.(formatted);

    if (!includeTime) {
      setOpen(false);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setSelectedTime(newTime);
    if (selectedDate) {
      const formatted = formatOutput(selectedDate, newTime);
      setInputValue(formatted);
      onChange?.(formatted);
    }
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    onChange?.(raw);

    // Try live parsing if user typed a valid date
    const iso = parseDateInputToISO(raw);
    if (iso) {
      const d = parseISO(iso);
      if (isValid(d)) {
        setSelectedDate(d);
      }
    }
  };

  // Display label when date is selected
  const displayLabel = React.useMemo(() => {
    if (!selectedDate || !isValid(selectedDate)) {
      return inputValue || "";
    }
    if (includeTime) {
      return `${format(selectedDate, "d MMM yyyy", { locale: sv })} kl ${selectedTime}`;
    }
    return formatDateDDMMYYYY(selectedDate);
  }, [selectedDate, selectedTime, includeTime, inputValue]);

  // Hours and minutes options
  const hours = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")),
    []
  );
  const minutes = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")),
    []
  );

  const [currentHour, currentMinute] = selectedTime.split(":");

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative flex items-center w-full">
          <Input
            value={inputValue}
            onChange={handleManualInputChange}
            placeholder={placeholder}
            disabled={disabled}
            className="rounded-xl pr-10 font-mono text-xs"
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="absolute right-1 h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              title="Öppna datumväljare"
            >
              {includeTime ? <Clock className="h-4 w-4" /> : <CalendarIcon className="h-4 w-4" />}
            </Button>
          </PopoverTrigger>
        </div>

        <PopoverContent
          className="w-auto p-0 glass rounded-2xl border-white/10 shadow-2xl z-50"
          align="start"
          sideOffset={6}
        >
          <div className="p-3 border-b border-border/60 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold">
              {displayLabel ? displayLabel : "Välj datum"}
            </div>
            <div className="flex gap-1">
              {selectedDate && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setSelectedDate(undefined);
                    setInputValue("");
                    onChange?.("");
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Rensa
                </Button>
              )}
            </div>
          </div>

          {/* Quick shortcuts */}
          <div className="p-2 border-b border-border/40 flex flex-wrap gap-1 bg-surface/30">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] rounded-lg px-2"
              onClick={() => handleDateSelect(new Date())}
            >
              Idag
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] rounded-lg px-2"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                handleDateSelect(tomorrow);
              }}
            >
              Imorgon
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] rounded-lg px-2"
              onClick={() => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                handleDateSelect(nextWeek);
              }}
            >
              Om 1 vecka
            </Button>
          </div>

          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            locale={sv}
            initialFocus
            className="p-3"
          />

          {includeTime && (
            <div className="p-3 border-t border-border/60 bg-surface/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>Klockslag:</span>
              </div>
              <div className="flex items-center gap-1">
                <Select
                  value={currentHour ?? "12"}
                  onValueChange={(h) => handleTimeChange(`${h}:${currentMinute ?? "00"}`)}
                >
                  <SelectTrigger className="h-8 w-16 text-xs rounded-xl font-mono">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 rounded-xl font-mono">
                    {hours.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="font-bold text-xs">:</span>
                <Select
                  value={currentMinute ?? "00"}
                  onValueChange={(m) => handleTimeChange(`${currentHour ?? "12"}:${m}`)}
                >
                  <SelectTrigger className="h-8 w-16 text-xs rounded-xl font-mono">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 rounded-xl font-mono">
                    {minutes.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="p-2 border-t border-border/60 bg-background/50 flex justify-end">
            <Button
              size="sm"
              className="h-7 text-xs rounded-xl px-3 gradient-sunset text-white"
              onClick={() => setOpen(false)}
            >
              Klar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
