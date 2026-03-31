import { useMemo } from "react";
import { useReceiptStore } from "@/stores/receiptStore";
import { useWarrantyStore } from "@/stores/warrantyStore";
import type { Receipt, Warranty } from "@/types";

interface CategoryCard {
  category: string;
  icon: string;
  amount: number;
  highlighted: boolean;
}

interface DashboardData {
  totalMonthlySpend: number;
  spendChangePercent: number;
  budgetUtilization: number;
  categoryBreakdown: CategoryCard[];
  expiringWarranty: Warranty | null;
  recentScans: Receipt[];
}

const CATEGORY_ICONS: Record<string, string> = {
  food: "restaurant",
  travel: "flight",
  warranty: "verified_user",
  utility: "bolt",
  shopping: "shopping_bag",
  other: "receipt_long",
};

const MONTHLY_BUDGET = 2000;

export function useDashboardData(): DashboardData {
  const receipts = useReceiptStore((state) => state.receipts);
  const warranties = useWarrantyStore((state) => state.warranties);

  return useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const thisMonthReceipts = receipts.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const lastMonthReceipts = receipts.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const totalMonthlySpend = thisMonthReceipts.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const lastMonthSpend = lastMonthReceipts.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const spendChangePercent =
      lastMonthSpend > 0
        ? Math.round(
            ((totalMonthlySpend - lastMonthSpend) / lastMonthSpend) * 100
          )
        : 0;

    const budgetUtilization = Math.min(totalMonthlySpend / MONTHLY_BUDGET, 1);

    const categoryTotals: Record<string, number> = {};
    thisMonthReceipts.forEach((r) => {
      categoryTotals[r.category] =
        (categoryTotals[r.category] ?? 0) + r.amount;
    });

    const sortedCategories = Object.entries(categoryTotals).sort(
      ([, a], [, b]) => b - a
    );
    const maxCategory = sortedCategories[0]?.[0];

    const categoryBreakdown: CategoryCard[] = sortedCategories
      .slice(0, 4)
      .map(([category, amount]) => ({
        category:
          category.charAt(0).toUpperCase() + category.slice(1),
        icon: CATEGORY_ICONS[category] ?? "receipt_long",
        amount: Math.round(amount * 100) / 100,
        highlighted: category === maxCategory,
      }));

    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringWarranty =
      warranties
        .filter((w) => {
          const exp = new Date(w.expirationDate);
          return exp > now && exp <= thirtyDaysFromNow;
        })
        .sort(
          (a, b) =>
            new Date(a.expirationDate).getTime() -
            new Date(b.expirationDate).getTime()
        )[0] ?? null;

    const recentScans = receipts.slice(0, 3);

    return {
      totalMonthlySpend,
      spendChangePercent,
      budgetUtilization,
      categoryBreakdown,
      expiringWarranty,
      recentScans,
    };
  }, [receipts, warranties]);
}
