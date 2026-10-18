// 중복 회원 찾기: 같은 사람이 계정을 두 개 이상 만든 경우를 묶어 줍니다.

export interface UserRec {
  id: string;
  name: string;
  email?: string;
  role?: string;
  part?: string;
  imageUrl?: string;
  createdAt?: number;
  approvedAt?: number;
  /** every field of the user document, to fill gaps when merging */
  raw: Record<string, unknown>;
}

export interface DupGroup { key: string; members: UserRec[]; keepId: string }

/** 이름 비교용: 공백·특수문자·대소문자를 무시합니다. */
export const normName = (s: string | undefined) => (s ?? '').normalize('NFC').replace(/[\s\-_.·()[\]]/g, '').toLowerCase();

const ROLE_RANK = (r?: string) => (!r || r === '대기권한' ? 0 : r === '일반대원' ? 1 : 2);

const toMs = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'seconds' in v) return Number((v as { seconds: number }).seconds) * 1000;
  if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis: () => number }).toMillis === 'function') return (v as { toMillis: () => number }).toMillis();
  return 0;
};

export const toUserRec = (id: string, d: Record<string, unknown>): UserRec => ({
  id,
  name: String(d.name || d.displayName || ''),
  email: d.email ? String(d.email) : undefined,
  role: d.role ? String(d.role) : undefined,
  part: d.part ? String(d.part) : undefined,
  imageUrl: d.imageUrl ? String(d.imageUrl) : d.photoURL ? String(d.photoURL) : undefined,
  createdAt: toMs(d.createdAt),
  approvedAt: toMs(d.approvedAt),
  raw: d,
});

const filled = (u: UserRec) => Object.values(u.raw).filter(v => v !== undefined && v !== null && v !== '').length;

/** 남길 계정 추천: 정식 승인된 직분 > 채워진 정보가 많은 쪽 > 먼저 만든 쪽. 로그인 중인 본인 계정은 항상 우선. */
export function pickKeep(members: UserRec[], selfId?: string): string {
  if (selfId && members.some(m => m.id === selfId)) return selfId;
  const sorted = [...members].sort((a, b) =>
    ROLE_RANK(b.role) - ROLE_RANK(a.role) ||
    filled(b) - filled(a) ||
    (a.createdAt || Infinity) - (b.createdAt || Infinity) ||
    a.id.localeCompare(b.id));
  return sorted[0].id;
}

export function findDuplicates(users: UserRec[], selfId?: string): DupGroup[] {
  const byName = new Map<string, UserRec[]>();
  for (const u of users) {
    const k = normName(u.name);
    if (!k || k === normName('이름 없음')) continue;
    byName.set(k, [...(byName.get(k) ?? []), u]);
  }
  // the same e-mail is a duplicate even when the names differ
  const byMail = new Map<string, UserRec[]>();
  for (const u of users) {
    const k = (u.email ?? '').trim().toLowerCase();
    if (k) byMail.set(k, [...(byMail.get(k) ?? []), u]);
  }
  const groups: UserRec[][] = [];
  for (const g of [...byName.values(), ...byMail.values()]) {
    if (g.length < 2) continue;
    const ids = g.map(m => m.id);
    const touching = groups.filter(x => x.some(m => ids.includes(m.id)));
    if (touching.length) {
      const merged = new Map<string, UserRec>();
      [...touching.flat(), ...g].forEach(m => merged.set(m.id, m));
      touching.forEach(t => groups.splice(groups.indexOf(t), 1));
      groups.push([...merged.values()]);
    } else groups.push([...g]);
  }
  return groups.filter(g => g.length > 1).map(g => ({
    key: g.map(m => m.id).sort().join('|'),
    members: g.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    keepId: pickKeep(g, selfId),
  }));
}

export interface MergePlan { keepId: string; removeIds: string[]; fill: Record<string, unknown> }

/** 남길 계정에 비어 있는 정보를 지울 계정에서 채워 넣는 계획. 직분은 남길 계정이 대기권한일 때만 가져옵니다. */
export function planMerge(g: DupGroup, keepId: string): MergePlan {
  const keep = g.members.find(m => m.id === keepId)!;
  const others = g.members.filter(m => m.id !== keepId);
  const fill: Record<string, unknown> = {};
  const skip = new Set(['createdAt', 'approvedAt', 'uid', 'role']);
  const order = [...others].sort((a, b) => ROLE_RANK(b.role) - ROLE_RANK(a.role) || filled(b) - filled(a));
  for (const o of order) {
    for (const [k, v] of Object.entries(o.raw)) {
      if (skip.has(k) || v === undefined || v === null || v === '') continue;
      const cur = keep.raw[k];
      if ((cur === undefined || cur === null || cur === '') && !(k in fill)) fill[k] = v;
    }
  }
  if (ROLE_RANK(keep.role) === 0) {
    const better = order.find(o => ROLE_RANK(o.role) > 0);
    if (better?.role) fill.role = better.role;
  }
  return { keepId, removeIds: others.map(o => o.id), fill };
}
