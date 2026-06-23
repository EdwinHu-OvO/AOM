import { ShoppingBag } from "lucide-react";

interface Props {
  itemCount: number;
  total: number;
  onClick(): void;
}

export function FloatingCartButton({ itemCount, total, onClick }: Props) {
  return (
    <button className="floating-cart" onClick={onClick} aria-label="Open cart">
      <ShoppingBag size={22} />
      <span>{itemCount}</span>
      <strong>${total.toFixed(2)}</strong>
    </button>
  );
}
