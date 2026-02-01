import Mark from "./Mark";

export default function Header() {
  return (
    <header className="w-full border-b">
      <div className="mx-auto max-w-6xl h-14 px-4 flex items-center justify-between">
        <Mark />
        <a href="/shop" className="px-4 py-2 rounded-xl bg-black text-white">
          Boutique
        </a>
      </div>
    </header>
  );
}
