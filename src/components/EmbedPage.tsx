import { ExternalLink } from 'lucide-react';

/** 다른 앱(교회 캘린더, 암송수첩)을 앱 안에서 그대로 보여 줍니다. */
export default function EmbedPage({ title, url }: { title: string; url: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">{title}</h1>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm whitespace-nowrap"
        >
          <ExternalLink className="w-4 h-4" /> 새 창에서 열기
        </a>
      </div>
      <iframe
        key={url}
        src={url}
        title={title}
        className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm"
        style={{ height: 'calc(100vh - 11rem)', minHeight: 480 }}
        allow="clipboard-write; fullscreen"
        loading="lazy"
      />
      <p className="text-xs text-gray-400">화면이 비어 있거나 로그인 창이 열리지 않으면 "새 창에서 열기"를 눌러 주세요.</p>
    </div>
  );
}
