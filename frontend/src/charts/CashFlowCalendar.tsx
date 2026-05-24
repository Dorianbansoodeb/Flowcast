export interface CalendarDay {
  date: string;
  day: number;
  weekday: number;
  income: number;
  expenses: number;
  net: number;
  transaction_count: number;
  mood: "inflow" | "outflow" | "heavy" | "neutral";
}

interface Props {
  year: number;
  month: number;
  days: CalendarDay[];
  onMonthChange?: (year: number, month: number) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function CashFlowCalendar({ year, month, days, onMonthChange }: Props) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const blanks = Array.from({ length: firstWeekday }, (_, i) => i);

  const prevMonth = () => {
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    onMonthChange?.(y, m);
  };

  const nextMonth = () => {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    onMonthChange?.(y, m);
  };

  return (
    <div className="cash-flow-calendar">
      <div className="calendar-header">
        <button type="button" className="btn btn-sm" onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <h4>{monthLabel(year, month)}</h4>
        <button type="button" className="btn btn-sm" onClick={nextMonth} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {blanks.map((b) => (
          <div key={`blank-${b}`} className="calendar-cell calendar-cell--empty" />
        ))}
        {days.map((d) => (
          <div
            key={d.date}
            className={`calendar-cell calendar-cell--${d.mood}`}
            title={
              d.transaction_count === 0
                ? "No activity"
                : `Net: $${d.net.toLocaleString()} · In: $${d.income.toLocaleString()} · Out: $${d.expenses.toLocaleString()}`
            }
          >
            <span className="calendar-day-num">{d.day}</span>
            {d.transaction_count > 0 && <span className="calendar-day-dot" aria-hidden />}
          </div>
        ))}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="legend-swatch legend-swatch--inflow" /> Money in
        </span>
        <span>
          <i className="legend-swatch legend-swatch--outflow" /> Money out
        </span>
        <span>
          <i className="legend-swatch legend-swatch--heavy" /> Heavy spend
        </span>
      </div>
    </div>
  );
}
