// 중복 회원 정리 (대장·지휘자): 같은 이름/이메일의 계정을 찾아 하나만 남깁니다.
import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { Loader2, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { findDuplicates, planMerge, toUserRec, type DupGroup, type UserRec } from '../lib/dedupe';

const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleDateString('ko-KR') : '-');

export default function DuplicateMembers({ selfId, onClose }: { selfId?: string; onClose: () => void }) {
  const [users, setUsers] = useState<UserRec[] | null>(null);
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => toUserRec(d.id, d.data())));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void load(); }, []);

  const groups: DupGroup[] = useMemo(() => (users ? findDuplicates(users, selfId) : []), [users, selfId]);

  const clean = async (g: DupGroup) => {
    const keepId = keep[g.key] ?? g.keepId;
    const plan = planMerge(g, keepId);
    const names = g.members.filter(m => plan.removeIds.includes(m.id)).map(m => `${m.email || m.id}`).join(', ');
    if (!window.confirm(`선택한 계정만 남기고 나머지 ${plan.removeIds.length}개를 명단에서 지웁니다.\n\n지울 계정: ${names}\n\n계속할까요?`)) return;
    setBusy(g.key); setErr(''); setMsg('');
    try {
      if (Object.keys(plan.fill).length) await updateDoc(doc(db, 'users', keepId), plan.fill);
      const keepName = g.members.find(m => m.id === keepId)?.name;
      for (const rid of plan.removeIds) {
        // 지울 계정이 쓴 게시글은 남길 계정 것으로 옮깁니다
        const posts = await getDocs(query(collection(db, 'board_posts'), where('authorUid', '==', rid)));
        for (const p of posts.docs) await updateDoc(p.ref, { authorUid: keepId, ...(keepName ? { author: keepName } : {}) });
        await deleteDoc(doc(db, 'users', rid));
      }
      setMsg(`${g.members[0].name}: ${plan.removeIds.length}개 계정을 정리했어요.`);
      await load();
    } catch (e) {
      setErr(`정리에 실패했어요: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-label="중복 회원 정리">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">중복 회원 정리</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="닫기"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            이름(띄어쓰기·기호 무시)이나 이메일이 같은 계정을 묶어 보여 줍니다. 남길 계정을 고르면 나머지는 명단에서 지워지고,
            남길 계정에 비어 있는 정보(파트·사진 등)는 지워지는 계정에서 채워집니다. 지워지는 계정이 쓴 게시글은 남길 계정으로 옮겨집니다.
            로그인 계정 자체는 남아 있어서, 지운 계정으로 다시 로그인하면 '가입 대기'로 나타납니다.
          </p>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          {!users && !err && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}
          {users && groups.length === 0 && <p className="py-8 text-center text-gray-500 text-sm">중복으로 보이는 회원이 없어요.</p>}
          {groups.map(g => {
            const sel = keep[g.key] ?? g.keepId;
            return (
              <div key={g.key} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">{g.members[0].name} · {g.members.length}개 계정</div>
                <div className="divide-y divide-gray-100">
                  {g.members.map(m => (
                    <label key={m.id} className={`flex items-start gap-3 p-3 cursor-pointer ${sel === m.id ? 'bg-blue-50/60' : ''}`}>
                      <input type="radio" name={g.key} className="mt-1" checked={sel === m.id}
                        disabled={!!selfId && g.members.some(x => x.id === selfId) && m.id !== selfId}
                        onChange={() => setKeep(k => ({ ...k, [g.key]: m.id }))} />
                      <div className="text-sm min-w-0">
                        <div className="font-medium text-gray-900">
                          {m.name} <span className="text-xs font-normal text-gray-500">{m.role || '직분 없음'}{m.part ? ` · ${m.part}` : ''}</span>
                          {m.id === selfId && <span className="ml-1 text-xs text-blue-600">(내 계정)</span>}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{m.email || '이메일 없음'}</div>
                        <div className="text-xs text-gray-400">가입 {fmt(m.createdAt)}{m.approvedAt ? ` · 승인 ${fmt(m.approvedAt)}` : ''}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="p-3 bg-gray-50 text-right">
                  <button onClick={() => void clean(g)} disabled={busy !== null}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
                    {busy === g.key ? '정리하는 중…' : '선택한 계정만 남기고 정리'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
