/**
 * The categories and payment methods a fresh Expense Tracker starts with.
 * Shared by the seed script and by the app itself, which fills an empty table
 * on first open — the deploy never runs the seed, so without that the entry
 * sheet had nothing to choose from.
 */
export const DEFAULT_CATEGORIES: { nameEn: string; nameTa: string; kind: "EXPENSE" | "INCOME" }[] = [
  { nameEn: "Rent", nameTa: "வாடகை", kind: "EXPENSE" },
  { nameEn: "School", nameTa: "பள்ளி", kind: "EXPENSE" },
  { nameEn: "Medical", nameTa: "மருத்துவம்", kind: "EXPENSE" },
  { nameEn: "Utilities", nameTa: "மின்சாரம் / தண்ணீர்", kind: "EXPENSE" },
  { nameEn: "Food", nameTa: "உணவு", kind: "EXPENSE" },
  { nameEn: "Travel", nameTa: "பயணம்", kind: "EXPENSE" },
  { nameEn: "Shopping", nameTa: "ஷாப்பிங்", kind: "EXPENSE" },
  { nameEn: "Household", nameTa: "வீட்டு செலவு", kind: "EXPENSE" },
  { nameEn: "Gifts", nameTa: "பரிசு", kind: "EXPENSE" },
  { nameEn: "Other", nameTa: "மற்றவை", kind: "EXPENSE" },
  { nameEn: "Salary", nameTa: "சம்பளம்", kind: "INCOME" },
  { nameEn: "Other income", nameTa: "பிற வருமானம்", kind: "INCOME" },
];

export const DEFAULT_METHODS = ["Cash", "GPay", "Card", "Bank transfer"];
