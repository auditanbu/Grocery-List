"use client";

import { useMemo } from "react";

import { formatPrice } from "@/lib/units";
import type { OccurrenceDTO } from "@/lib/budget/types";

import { OccurrenceRow } from "./OccurrenceRow";

type Section = {
  title: string;
  accent: string;
  occurrences: OccurrenceDTO[];
};

/**
 * The month's occurrences grouped by where they stand, rather than one flat
 * chronological list — what a family actually wants to know is "what still
 * needs paying", not "what is the 14th".
 */
export function BudgetList({
  occurrences,
  onOpen,
}: {
  occurrences: OccurrenceDTO[];
  onOpen: (occurrence: OccurrenceDTO) => void;
}) {
  const sections = useMemo<Section[]>(() => {
    const pick = (...states: OccurrenceDTO["state"][]) =>
      occurrences.filter((occurrence) => states.includes(occurrence.state));

    return [
      { title: "Overdue", accent: "text-ios-red", occurrences: pick("OVERDUE") },
      { title: "Due today", accent: "text-ios-orange", occurrences: pick("DUE_TODAY") },
      { title: "Upcoming", accent: "text-ios-label-2", occurrences: pick("PLANNED") },
      { title: "Paid", accent: "text-ios-green", occurrences: pick("PAID") },
      { title: "Skipped", accent: "text-ios-label-3", occurrences: pick("SKIPPED") },
    ].filter((section) => section.occurrences.length > 0);
  }, [occurrences]);

  if (sections.length === 0) {
    return (
      <section className="ios-card p-8 text-center">
        <p className="text-[16px] font-medium">Nothing due this month</p>
        <p className="mt-1 text-[14px] text-ios-label-2">
          Expenses you add will appear here on their due dates.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const total = section.occurrences.reduce(
          (sum, occurrence) => sum + (occurrence.paidAmount ?? occurrence.plannedAmount),
          0,
        );

        return (
          <section key={section.title}>
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <h2 className={`text-[13px] font-semibold uppercase tracking-wide ${section.accent}`}>
                {section.title}
              </h2>
              <span className="text-[13px] tabular-nums text-ios-label-2">{formatPrice(total)}</span>
            </div>
            <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
              {section.occurrences.map((occurrence) => (
                <OccurrenceRow key={occurrence.key} occurrence={occurrence} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
