export async function createTrip(_data: Record<string, unknown>): Promise<string> { return ""; }
export async function updateTrip(_id: string, _updates: Record<string, unknown>): Promise<void> {}
export async function deleteTrip(_id: string): Promise<void> {}
export async function addGhostParticipant(_tripId: string, _name: string, _contact?: { email?: string; phone?: string }): Promise<void> {}
export async function addExpense(_tripId: string, _data: Record<string, unknown>): Promise<string> { return ""; }
export async function updateExpense(_tripId: string, _expenseId: string, _updates: Record<string, unknown>): Promise<void> {}
export async function deleteExpense(_tripId: string, _expenseId: string): Promise<void> {}
export async function createInvitation(_tripId: string, _invitedByUid: string, _inviteeEmail?: string): Promise<string> { return ""; }
export function buildInviteLink(_inviteId: string, _tripId: string): string { return ""; }
export function listenToTrip(_tripId: string, _cb: (trip: unknown) => void): () => void { return () => {}; }
export function listenToExpenses(_tripId: string, _cb: (expenses: unknown[]) => void): () => void { return () => {}; }
export function listenToCarpools(_tripId: string, _cb: (carpools: unknown[]) => void): () => void { return () => {}; }
export function listenToSettlements(_tripId: string, _cb: (settlements: unknown[]) => void): () => void { return () => {}; }
export function listenToPlannerItems(_tripId: string, _cb: (items: unknown[]) => void): () => void { return () => {}; }
