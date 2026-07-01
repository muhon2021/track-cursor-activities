interface ClientProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
}

export function ClientProgressRing({
  progress,
  size = 60,
  strokeWidth = 6,
}: ClientProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  const getColor = () => {
    if (progress >= 75) return "text-green-500";
    if (progress >= 50) return "text-blue-500";
    if (progress >= 25) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-muted/30"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`transition-all duration-500 ease-out ${getColor()}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold">{progress}%</span>
      </div>
    </div>
  );
}
