"use client";

type Props = {
  tab: string;
  setTab: (tab: string) => void;
};

export default function NavbarTabs({ tab, setTab }: Props) {
  const tabs = [
    { id: "home", label: "🏠 Home" },
    { id: "curve", label: "📈 Load Curve" },
    { id: "ai", label: "🤖 AI Insights" },
  ];

  return (
    <div className="flex justify-center gap-4 mb-6">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-5 py-2 rounded-xl font-medium transition ${
            tab === t.id
              ? "bg-blue-600 shadow-lg scale-105"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}