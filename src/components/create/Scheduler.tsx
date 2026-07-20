"use client";

import { useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { primaryButton, secondaryButton, eyebrowClass } from "@/components/ui";
import {
  SCHEDULE_TIME_OPTIONS,
  timeOptionById,
  formatDateFull,
  toISODate,
  type DateTimeCombo,
  type ScheduleTimeOptionId,
} from "@/lib/time-windows";

export type SchedulerTab = "days" | "times" | "plan";

const MAX_DATES = 2;
const MAX_COMBOS = 2;

function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const TABS: { id: SchedulerTab; label: string }[] = [
  { id: "days", label: "Pick the days" },
  { id: "times", label: "Pick the times" },
  { id: "plan", label: "Check the plan" },
];

export function Scheduler({
  selectedDates,
  setSelectedDates,
  combos,
  setCombos,
  activeDate,
  setActiveDate,
  tab,
  setTab,
  onBackToPreviousStep,
  onContinue,
}: {
  selectedDates: string[];
  setSelectedDates: (dates: string[]) => void;
  combos: DateTimeCombo[];
  setCombos: (combos: DateTimeCombo[]) => void;
  activeDate: string | null;
  setActiveDate: (date: string) => void;
  tab: SchedulerTab;
  setTab: (tab: SchedulerTab) => void;
  onBackToPreviousStep: () => void;
  onContinue: () => void;
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const selectedDateObjs = useMemo(
    () => selectedDates.map(parseISODate),
    [selectedDates],
  );

  const orderedDates = useMemo(
    () => [...selectedDates].sort(),
    [selectedDates],
  );

  const currentDate =
    activeDate && orderedDates.includes(activeDate)
      ? activeDate
      : orderedDates[0] ?? null;

  const limitReached = combos.length >= MAX_COMBOS;

  function handleSelect(dates: Date[] | undefined) {
    const next = (dates ?? []).map(toISODate);
    setSelectedDates(next);
    // Drop any time picks tied to a date that was just removed.
    const filtered = combos.filter((c) => next.includes(c.date));
    if (filtered.length !== combos.length) setCombos(filtered);
  }

  function isComboSelected(date: string, optionId: ScheduleTimeOptionId) {
    return combos.some((c) => c.date === date && c.optionId === optionId);
  }

  function toggleCombo(date: string, optionId: ScheduleTimeOptionId) {
    if (isComboSelected(date, optionId)) {
      setCombos(
        combos.filter((c) => !(c.date === date && c.optionId === optionId)),
      );
      return;
    }
    if (limitReached) return;
    setCombos([...combos, { date, optionId }]);
  }

  const orderedCombos = useMemo(() => {
    const order = SCHEDULE_TIME_OPTIONS.map((o) => o.id);
    return [...combos].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return order.indexOf(a.optionId) - order.indexOf(b.optionId);
    });
  }, [combos]);

  return (
    <div>
      <SchedulerTabs tab={tab} setTab={setTab} hasDates={selectedDates.length > 0} hasCombos={combos.length > 0} />

      {tab === "days" ? (
        <div className="mt-6">
          <h1 className="text-2xl text-navy">When could this actually happen?</h1>
          <p className="mt-2 text-muted">Tap up to two days that could work.</p>

          <div className="mt-5 flex justify-center rounded-2xl border border-border bg-cream/70 p-3 sm:p-4">
            <DayPicker
              mode="multiple"
              max={MAX_DATES}
              selected={selectedDateObjs}
              onSelect={handleSelect}
              disabled={{ before: today }}
              startMonth={new Date(today.getFullYear(), today.getMonth(), 1)}
              showOutsideDays={false}
              className="dremmt-calendar"
            />
          </div>

          {selectedDates.length > 0 ? (
            <p className="mt-4 text-sm text-navy">
              {selectedDates.length === MAX_DATES
                ? "Two days picked."
                : "One day picked. Add one more, or continue."}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              className={primaryButton}
              disabled={selectedDates.length === 0}
              onClick={() => setTab("times")}
            >
              Choose times
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={onBackToPreviousStep}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {tab === "times" ? (
        <div className="mt-6">
          <h1 className="text-2xl text-navy">What times could work?</h1>
          <p className="mt-2 text-muted">
            Select all that apply. Your friend will choose the final one.
          </p>

          {orderedDates.length > 1 ? (
            <div
              className="mt-5 flex flex-wrap gap-2"
              role="tablist"
              aria-label="Choose which day to set times for"
            >
              {orderedDates.map((date) => {
                const isActive = date === currentDate;
                const count = combos.filter((c) => c.date === date).length;
                return (
                  <button
                    key={date}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveDate(date)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-sky-deep bg-sky/10 text-navy"
                        : "border-border-strong bg-cream text-navy hover:bg-surface"
                    }`}
                  >
                    {formatDateFull(date)}
                    {count > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-deep px-1 text-xs font-semibold text-white">
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : currentDate ? (
            <p className="mt-5 text-lg font-medium text-navy">
              {formatDateFull(currentDate)}
            </p>
          ) : null}

          {currentDate ? (
            <div className="mt-4 space-y-3">
              {SCHEDULE_TIME_OPTIONS.map((option) => {
                const active = isComboSelected(currentDate, option.id);
                const disabled = !active && limitReached;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => toggleCombo(currentDate, option.id)}
                    className={`flex w-full min-h-14 items-center justify-between gap-4 rounded-full border px-5 py-3.5 text-left transition-colors ${
                      active
                        ? "border-sky-deep bg-sky/10"
                        : "border-border-strong bg-cream hover:bg-surface"
                    } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          active ? "bg-sky-deep" : "bg-transparent ring-1 ring-border-strong"
                        }`}
                      />
                      <span className="text-lg font-semibold text-navy">
                        {option.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-base text-muted">
                      {option.descriptor}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <p className="mt-4 min-h-6 text-sm text-muted">
            {limitReached
              ? "Two choices are plenty—your friend just needs something easy to answer."
              : "Pick one or two times in total."}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              className={primaryButton}
              disabled={combos.length === 0}
              onClick={() => setTab("plan")}
            >
              Check the plan
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setTab("days")}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {tab === "plan" ? (
        <div className="mt-6">
          <h1 className="text-2xl text-navy">Check the plan</h1>
          <p className="mt-2 text-muted">
            {orderedCombos.length === 1
              ? "This is the choice your friend will see."
              : "These are the two choices your friend will see."}
          </p>

          <ul className="mt-5 space-y-3">
            {orderedCombos.map((combo) => {
              const option = timeOptionById(combo.optionId);
              return (
                <li
                  key={`${combo.date}-${combo.optionId}`}
                  className="flex items-center gap-3 rounded-full border border-border-strong bg-cream px-5 py-3.5"
                >
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-deep" />
                  <span className="text-lg font-medium text-navy">
                    {formatDateFull(combo.date)} · {option?.label}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className={`${eyebrowClass} mt-6`}>Your friend picks one</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              className={primaryButton}
              disabled={combos.length === 0}
              onClick={onContinue}
            >
              Continue
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setTab("times")}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SchedulerTabs({
  tab,
  setTab,
  hasDates,
  hasCombos,
}: {
  tab: SchedulerTab;
  setTab: (tab: SchedulerTab) => void;
  hasDates: boolean;
  hasCombos: boolean;
}) {
  function canReach(target: SchedulerTab): boolean {
    if (target === "days") return true;
    if (target === "times") return hasDates;
    return hasDates && hasCombos;
  }

  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Scheduling steps">
      {TABS.map((t, index) => {
        const isActive = t.id === tab;
        const reachable = canReach(t.id);
        return (
          <div key={t.id} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "step" : undefined}
              disabled={!reachable}
              onClick={() => reachable && setTab(t.id)}
              className={`flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isActive
                  ? "border-orange bg-orange/10"
                  : "border-border bg-cream/60 hover:bg-cream"
              }`}
            >
              <span
                className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                  isActive ? "text-orange-deep" : "text-muted"
                }`}
              >
                Step {index + 1}
              </span>
              <span className="text-sm font-medium text-navy">{t.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
