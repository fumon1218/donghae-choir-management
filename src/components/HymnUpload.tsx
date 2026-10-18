// 지휘자용: 악보 앱의 public/hymns 폴더를 골라 Firestore에 올립니다.
import React, { useRef, useState } from 'react';
import { planUpload, runUpload, type UploadFile, type UploadPlan } from '../lib/hymnData';

export default function HymnUpload({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const cancel = useRef({ cancelled: false });
  const [plan, setPlan] = useState<UploadPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<[number, number]>([0, 0]);
  const [msg, setMsg] = useState('');
  const [failed, setFailed] = useState<string[]>([]);

  const pick = async (list: FileList | null) => {
    if (!list || !list.length) return;
    setMsg('폴더를 확인하는 중…'); setPlan(null); setFailed([]);
    try {
      const files: UploadFile[] = Array.from(list).map(f => ({
        path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        size: f.size, read: () => f.arrayBuffer(),
      }));
      const p = await planUpload(files);
      setPlan(p);
      setMsg(`곡 ${p.songs.length}개를 올릴 수 있어요.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };

  const go = async () => {
    if (!plan) return;
    cancel.current = { cancelled: false };
    setBusy(true); setProg([0, plan.songs.length]); setMsg('올리는 중… 화면을 닫지 마세요.');
    try {
      const r = await runUpload(plan, (d, t) => setProg([d, t]), cancel.current);
      setFailed(r.failed);
      setMsg(cancel.current.cancelled ? `중단했어요 (${r.written}곡 올림).` : `완료: ${r.written}곡을 올렸어요.${r.failed.length ? ` 실패 ${r.failed.length}곡.` : ''}`);
    } catch (e) {
      setMsg(`올리기에 실패했어요: ${e instanceof Error ? e.message : String(e)} (권한 규칙이 배포되었는지 확인해 주세요)`);
    } finally { setBusy(false); }
  };

  return (
    <div role="dialog" aria-label="찬송가 자료 올리기" style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', color: '#222', borderRadius: 14, padding: 20, width: '100%', maxWidth: 440, maxHeight: '88vh', overflow: 'auto' }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>찬송가 자료 올리기</div>
        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: '0 0 12px' }}>
          악보 앱의 <b>public/hymns</b> 폴더(안에 collections.json, hymn, grace 폴더)를 선택하세요. 올린 자료는 로그인한 대원만 볼 수 있어요. 같은 곡은 덮어씁니다.
        </p>
        <input ref={input} type="file" multiple style={{ display: 'none' }}
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          onChange={e => void pick(e.target.files)} />
        <button disabled={busy} onClick={() => input.current?.click()} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #aaa', background: '#fff' }}>폴더 선택</button>
        {plan && !busy && <button onClick={() => void go()} style={{ marginLeft: 8, padding: '9px 14px', borderRadius: 10, border: 0, background: '#2563eb', color: '#fff', fontWeight: 700 }}>올리기 시작</button>}
        {busy && <button onClick={() => { cancel.current.cancelled = true; }} style={{ marginLeft: 8, padding: '9px 14px', borderRadius: 10, border: '1px solid #c33', background: '#fff', color: '#c33' }}>중단</button>}
        {busy && <div style={{ height: 8, background: '#eee', borderRadius: 4, marginTop: 12 }}><div style={{ height: 8, borderRadius: 4, background: '#2563eb', width: `${prog[1] ? (prog[0] / prog[1]) * 100 : 0}%` }} /></div>}
        {msg && <p style={{ fontSize: 13, marginTop: 10 }}>{msg}{busy ? ` (${prog[0]}/${prog[1]})` : ''}</p>}
        {plan && plan.warnings.length > 0 && <details style={{ fontSize: 12, color: '#a60' }}><summary>건너뛰는 항목 {plan.warnings.length}개</summary>{plan.warnings.slice(0, 40).map((w, i) => <div key={i}>{w}</div>)}</details>}
        {failed.length > 0 && <details style={{ fontSize: 12, color: '#c33' }}><summary>실패 {failed.length}개</summary>{failed.slice(0, 40).map((w, i) => <div key={i}>{w}</div>)}</details>}
        <div style={{ textAlign: 'right', marginTop: 14 }}><button disabled={busy} onClick={onClose} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #aaa', background: '#fff' }}>닫기</button></div>
      </div>
    </div>
  );
}
