import Link from "next/link";

export function StoreMark() {
  return (
    <Link href="/products" className="inline-flex items-center gap-3 font-semibold tracking-tight">
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-sm font-black text-[#08120e]"
      >
        G
      </span>
      <span>Game Store</span>
    </Link>
  );
}
