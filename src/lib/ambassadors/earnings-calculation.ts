export type EarningsLevel = {
  percentage: number;
};

export type FirstPurchaseBonusConfig = {
  enabled: boolean;
  minimumAmount: number;
  amount: number;
};

export type EarningsCalculationInput = {
  goal: number;
  months: number;
  monthlyVolume: number;
  duplication: number;
  levels: EarningsLevel[];
  firstPurchaseBonus: FirstPurchaseBonusConfig;
};

export function calculateEarnings({
  goal,
  months,
  monthlyVolume,
  duplication,
  levels,
  firstPurchaseBonus,
}: EarningsCalculationInput) {
  const rates = levels.map((level) => level.percentage / 100);
  const earningsPerDirectBranch = monthlyVolume * rates.reduce(
    (total, rate, index) => total + duplication ** index * rate,
    0,
  );
  const directReferrals = Math.max(1, Math.ceil(goal / Math.max(earningsPerDirectBranch, 0.01)));
  const people = rates.map((_, index) => directReferrals * duplication ** index);
  const earnings = people.map((count, index) => count * monthlyVolume * rates[index]);
  const projectedMonthly = earnings.reduce((sum, value) => sum + value, 0);
  const directReferralsPerMonth = Math.ceil(directReferrals / months);
  const firstPurchaseBonusEligible = Boolean(
    firstPurchaseBonus.enabled
    && firstPurchaseBonus.minimumAmount > 0
    && firstPurchaseBonus.amount > 0
    && monthlyVolume >= firstPurchaseBonus.minimumAmount,
  );
  const firstPurchaseBonusTotal = firstPurchaseBonusEligible
    ? directReferrals * firstPurchaseBonus.amount
    : 0;

  return {
    people,
    earnings,
    projectedMonthly,
    directReferrals,
    directReferralsPerMonth,
    totalPeople: people.reduce((sum, value) => sum + value, 0),
    firstPurchaseBonusEligible,
    firstPurchaseBonusTotal,
    firstPurchaseBonusMonthlyAverage: firstPurchaseBonusTotal / months,
  };
}
