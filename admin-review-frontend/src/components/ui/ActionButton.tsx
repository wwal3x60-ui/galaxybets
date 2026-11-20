import { Icon } from "./Icon";

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  color?: "primary" | "secondary";
  disabled?: boolean;
  isLoading?: boolean;
  noShadow?: boolean;
}

const ActionButton = ({ onClick, children, color = "primary", disabled = false, isLoading = false, noShadow = false }: ActionButtonProps) => {
  const colorClass = color === "primary" ? "mcPrimary" : "bg-[rgba(63,71,84,0.24)]";
  const hoverClass = noShadow ? "" : color === "primary" ? "hover:shadow-blue-600/50" : "hover:shadow-gray-600/50";
  return (
    <button onClick={onClick} disabled={disabled || isLoading} className={`group/button cursor-pointer rounded-full relative inline-flex items-center justify-center overflow-hidden ${colorClass} backdrop-blur-lg px-5 py-2 text-base font-semibold text-white transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-xl active:scale-100 ${hoverClass}  ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : ""}`}>
      <div className="flex gap-1 items-center justify-center font-normal">{children}</div>
      <div className="absolute inset-0 flex h-full w-full justify-center transform-[skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:transform-[skew(-13deg)_translateX(100%)]">
        <div className="relative h-full w-10 bg-white/30" />
      </div>
    </button>
  )
}

export default ActionButton;