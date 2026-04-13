"use client";

interface Props {
  brand: string;
  season: string;
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-xl font-semibold text-slate-400">{title}</h2>
        <p className="text-slate-400 mt-2">{description || "이 페이지는 현재 개발 중입니다."}</p>
      </div>
    </div>
  );
}
