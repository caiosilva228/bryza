'use client';
import type { CompensationStatus } from '@/models/types';
import { COMPENSATION_STATUS_LABELS } from '@/utils/formatDriverCompensation';

const COLORS: Record<CompensationStatus, { bg: string; color: string; border: string }> = {
  open:     { bg: '#FEF9C3', color: '#92400E', border: '#FCD34D' },
  approved: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
  paid:     { bg: '#DCFCE7', color: '#166534', border: '#86EFAC' },
};

export default function CompensationStatusBadge({ status }: { status: CompensationStatus }) {
  const c = COLORS[status] || COLORS.open;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
      backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {COMPENSATION_STATUS_LABELS[status] || status}
    </span>
  );
}
