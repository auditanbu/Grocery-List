/**
 * The categories and payment methods a fresh Expense Tracker starts with.
 * Shared by the seed script and by the app itself, which fills an empty table
 * on first open — the deploy never runs the seed, so without that the entry
 * sheet had nothing to choose from.
 */
export const DEFAULT_CATEGORIES: { nameEn: string; nameTa: string; kind: "EXPENSE" | "INCOME" }[] = [
  { nameEn: "Food", nameTa: "உணவு", kind: "EXPENSE" },
  { nameEn: "Tea", nameTa: "தேநீர்", kind: "EXPENSE" },
  { nameEn: "Vehicle", nameTa: "வாகனம்", kind: "EXPENSE" },
  { nameEn: "Salary", nameTa: "சம்பளம்", kind: "INCOME" },
  { nameEn: "Other income", nameTa: "பிற வருமானம்", kind: "INCOME" },
];

export const DEFAULT_METHODS = ["Cash", "GPay", "Card", "Bank transfer"];
