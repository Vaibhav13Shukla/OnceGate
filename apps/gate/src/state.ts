export type ReceiptStatus = 'PENDING' | 'COMMITTED' | 'FAILED' | 'UNKNOWN';

const transitions: Record<ReceiptStatus, readonly ReceiptStatus[]> = {
  PENDING: ['COMMITTED', 'FAILED', 'UNKNOWN'],
  UNKNOWN: ['COMMITTED', 'FAILED'],
  COMMITTED: [],
  FAILED: []
};

export function canTransition(from: ReceiptStatus, to: ReceiptStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: ReceiptStatus, to: ReceiptStatus): void {
  if (!canTransition(from, to)) throw new Error(`Illegal receipt transition: ${from} -> ${to}`);
}
