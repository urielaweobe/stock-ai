import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

const Calendar = React.lazy(async () => {
  const { Calendar } = await import("./calendar");
  return { default: Calendar };
});

const dateFormat = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type DatePickerProps = {
  date: DateRange | undefined;
  setDate: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  className?: string;
};

export function DatePickerWithRange({
  date,
  setDate,
  className,
}: DatePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "md:w-[300px] justify-start text-left font-normal cursor-pointer",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {dateFormat.format(date.from)} -{" "}
                  {dateFormat.format(date.to)}
                </>
              ) : (
                dateFormat.format(date.from)
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <React.Suspense fallback={<p role="status" className="p-4">Loading calendar…</p>}>
            <Calendar
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={1}
              className="md:w-[300px] w-full"
            />
          </React.Suspense>
        </PopoverContent>
      </Popover>
    </div>
  );
}
