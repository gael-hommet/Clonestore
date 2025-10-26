import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image src="/brand/icon_master_1024.png" alt="CloneStore" width={28} height={28} priority />
      <span className="hidden sm:block font-semibold">CloneStore</span>
    </Link>
  );
}
