export interface CommissionPaymentSummary {
  releasedAmount: number;
  commissionCount: number;
  ambassadorCount: number;
  minimumPaymentAmount: number;
}

export type CommissionType = 'network_percentage' | 'first_purchase_bonus';

export interface ReleasedCommission {
  id: string;
  orderNumber: string;
  createdAt: string | null;
  level: number;
  commissionType: CommissionType;
  amount: number;
}

export interface AmbassadorCommissionGroup {
  ambassadorId: string;
  name: string;
  username: string;
  pixType: string;
  pixMasked: string;
  releasedAmount: number;
  minimumPaymentAmount: number;
  meetsMinimum: boolean;
  commissions: ReleasedCommission[];
}

export interface ReleasedCommissionsData {
  summary: CommissionPaymentSummary;
  groups: AmbassadorCommissionGroup[];
}

export interface CreateCommissionPaymentInput {
  ambassadorId: string;
  commissionIds: string[];
  paymentReference: string;
  notes?: string;
  overrideMinimum: boolean;
  overrideReason?: string;
}

export interface PaymentActionResult {
  success: boolean;
  message: string;
  paymentId?: string;
}
