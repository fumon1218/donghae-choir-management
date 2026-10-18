import { useState } from 'react';
import { Download } from 'lucide-react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const SETTINGS_DOCS = ['hymns_data', 'opening_hymns', 'schedules', 'advertisement', 'menu_config', 'roles'];
const COLLECTIONS = ['users', 'board_categories', 'board_posts', 'practice_checks'];

function save(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const today = () => new Date().toISOString().slice(0, 10);
const partLabel: Record<string, string> = { Soprano: '소프라노', Alto: '알토', Tenor: '테너', Bass: '베이스', Orchestra: '오케스트라' };
const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** 대장·지휘자용: 앱의 주요 데이터를 파일로 내려받습니다 (복구용 보관). */
export default function BackupCard() {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const fullBackup = async () => {
    setBusy('json'); setMsg('');
    try {
      const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), settings: {}, collections: {} };
      const skipped: string[] = [];
      for (const id of SETTINGS_DOCS) {
        try {
          const s = await getDoc(doc(db, 'settings', id));
          if (s.exists()) (out.settings as Record<string, unknown>)[id] = s.data();
        } catch { skipped.push(`settings/${id}`); }
      }
      for (const c of COLLECTIONS) {
        try {
          const snap = await getDocs(collection(db, c));
          (out.collections as Record<string, unknown>)[c] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { skipped.push(c); }
      }
      const text = JSON.stringify(out, (_k, v) => (v && typeof v === 'object' && typeof v.toDate === 'function' ? v.toDate().toISOString() : v), 2);
      save(`donghae-choir-backup-${today()}.json`, text, 'application/json');
      setMsg(skipped.length ? `내려받았지만 읽지 못한 항목이 있어요: ${skipped.join(', ')}` : '백업 파일을 내려받았어요.');
    } catch (e) {
      setMsg('백업 중 오류가 발생했어요: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(''); }
  };

  const membersCsv = async () => {
    setBusy('csv'); setMsg('');
    try {
      const snap = await getDocs(collection(db, 'users'));
      const rows = snap.docs.map(d => d.data()).filter(u => u.role !== '대기권한');
      const header = ['이름', '파트', '직분', '이메일'];
      const lines = [header.map(csvCell).join(','), ...rows.map(u => [u.name || u.displayName, partLabel[u.part] || u.part, u.role, u.email].map(csvCell).join(','))];
      save(`donghae-choir-members-${today()}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
      setMsg(`대원 ${rows.length}명 명단을 내려받았어요.`);
    } catch (e) {
      setMsg('명단을 내려받지 못했어요: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(''); }
  };

  const btn = 'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-bold border border-[#CFC7B2] bg-white hover:bg-[#F7F3EA] disabled:opacity-50';
  return (
    <div className="bg-white rounded-2xl border border-[#E6DFCF] p-5 md:p-6">
      <h2 className="text-lg font-bold text-[#1F2D4D]" style={{ fontFamily: "'Noto Serif KR', serif" }}>데이터 백업</h2>
      <p className="text-sm text-gray-500 mt-1 leading-relaxed">대원 명단, 월별 찬송가, 시작찬송, 연습 일정, 공지, 게시글을 파일로 보관합니다. 잘못 지웠을 때 복구하는 데 씁니다. 찬송가 악보 자료는 포함되지 않습니다.</p>
      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={fullBackup} disabled={!!busy} className={btn}><Download className="w-4 h-4" />{busy === 'json' ? '내려받는 중…' : '전체 백업 (JSON)'}</button>
        <button onClick={membersCsv} disabled={!!busy} className={btn}><Download className="w-4 h-4" />{busy === 'csv' ? '내려받는 중…' : '대원 명단 (엑셀용 CSV)'}</button>
      </div>
      {msg && <p className="text-sm text-gray-700 mt-3">{msg}</p>}
    </div>
  );
}
