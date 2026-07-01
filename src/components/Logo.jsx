const CX = 50, CY = 50, CR = 26

function makeRay(angleDeg, len) {
  const a = (angleDeg * Math.PI) / 180
  const start = CR + 3
  return {
    x1: CX + Math.cos(a) * start,
    y1: CY + Math.sin(a) * start,
    x2: CX + Math.cos(a) * (start + len),
    y2: CY + Math.sin(a) * (start + len),
  }
}

// 20 rays at 18° intervals — irregular lengths mimic a natural corona
const RAY_LENGTHS = [17, 6, 11, 6, 19, 7, 12, 5, 17, 7, 11, 6, 19, 6, 12, 7, 17, 5, 11, 7]
const rays = RAY_LENGTHS.map((len, i) => makeRay(i * 18, len))

export default function Logo({
  size = 36,
  fontFamily = "'Inter', sans-serif",
  fontWeight = '500',
  fontStyle = 'normal',
  fontSize = '28',
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Syzygy logo"
    >
      {rays.map((r, i) => (
        <line
          key={i}
          x1={r.x1} y1={r.y1}
          x2={r.x2} y2={r.y2}
          stroke="#1a1a1a"
          strokeWidth={i % 5 === 0 ? 2 : 1.2}
          strokeLinecap="round"
        />
      ))}
      <circle cx={CX} cy={CY} r={CR} fill="#1a1a1a" />
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontStyle={fontStyle}
      >
        S
      </text>
    </svg>
  )
}
