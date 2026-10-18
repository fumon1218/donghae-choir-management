// 앱 전체에서 쓰는 장식: 구분선(올리브 가지)과 빈 화면 그림
const BASE = import.meta.env.BASE_URL;

export function Divider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`} aria-hidden="true">
      <span className="flex-1 h-px bg-gradient-to-r from-transparent to-[#C99A2E]/60" />
      <img src={`${BASE}images/dash-olive.png`} alt="" className="w-9 h-9 object-contain rotate-[-20deg]" />
      <span className="flex-1 h-px bg-gradient-to-l from-transparent to-[#C99A2E]/60" />
    </div>
  );
}

export function EmptyArt({ title, hint, className = '' }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <img src={`${BASE}images/dash-empty.png`} alt="" aria-hidden="true" className="w-52 md:w-64 rounded-2xl mb-3" />
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
