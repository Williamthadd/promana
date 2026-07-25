import { useEffect, useRef } from 'react'
import {
  ArrowDown,
  Building2,
  CalendarDays,
  FolderKanban,
  ListTodo,
  MapPin,
  MousePointer2,
  Rocket,
  Sparkles,
  StickyNote,
} from 'lucide-react'
import { normalizeLightBackgroundColor } from '../utils/lightBackground'

const PROMANA_PRIMARY = '#31ACD3'
const PROMANA_SECONDARY = '#863BFF'

const WORKSPACE_DETAILS = {
  projects: {
    label: 'Projects',
    buildingName: 'Project Tower',
    description: 'Your local codebases, languages, paths, and IDE launchers.',
    icon: FolderKanban,
    accent: PROMANA_PRIMARY,
  },
  launchpad: {
    label: 'Launchpad',
    buildingName: 'Launch Station',
    description: 'A fast terminal for your everyday websites and tools.',
    icon: Rocket,
    accent: '#3188E8',
  },
  notes: {
    label: 'Notes',
    buildingName: 'Knowledge House',
    description: 'Snippets, SQL, configs, and reference notes live here.',
    icon: StickyNote,
    accent: '#7367E8',
  },
  tasks: {
    label: 'Tasks',
    buildingName: 'Action Center',
    description: 'Turn your goals into focused, trackable task groups.',
    icon: ListTodo,
    accent: '#24B8AE',
  },
  calendar: {
    label: 'Calendar',
    buildingName: 'Time Tower',
    description: 'Plan targets, linked work, and reminders by date.',
    icon: CalendarDays,
    accent: '#3B9FD1',
  },
  ai: {
    label: 'Ask AI',
    buildingName: 'Intelligence Spire',
    description: 'Ask questions across every part of your workspace.',
    icon: Sparkles,
    accent: PROMANA_SECONDARY,
  },
}

const BUILDING_LAYOUT = [
  {
    id: 'notes',
    x: 535,
    y: 332,
    width: 68,
    depth: 50,
    height: 145,
    variant: 'notes',
  },
  {
    id: 'ai',
    x: 690,
    y: 390,
    width: 92,
    depth: 64,
    height: 225,
    variant: 'spire',
  },
  {
    id: 'launchpad',
    x: 368,
    y: 418,
    width: 84,
    depth: 58,
    height: 112,
    variant: 'antenna',
  },
  {
    id: 'calendar',
    x: 900,
    y: 470,
    width: 84,
    depth: 60,
    height: 158,
    variant: 'clock',
  },
  {
    id: 'projects',
    x: 347,
    y: 610,
    width: 98,
    depth: 68,
    height: 188,
    variant: 'projects',
  },
  {
    id: 'tasks',
    x: 810,
    y: 620,
    width: 106,
    depth: 72,
    height: 138,
    variant: 'tasks',
  },
]

function hexToRgb(color) {
  const normalizedColor = normalizeLightBackgroundColor(color)

  return {
    red: Number.parseInt(normalizedColor.slice(1, 3), 16),
    green: Number.parseInt(normalizedColor.slice(3, 5), 16),
    blue: Number.parseInt(normalizedColor.slice(5, 7), 16),
  }
}

function mixHexColors(baseColor, mixedColor, weight = 0.5) {
  const base = hexToRgb(baseColor)
  const mixed = hexToRgb(mixedColor)
  const safeWeight = Math.min(1, Math.max(0, weight))
  const channel = (baseValue, mixedValue) =>
    Math.round(baseValue + (mixedValue - baseValue) * safeWeight)
      .toString(16)
      .padStart(2, '0')

  return `#${channel(base.red, mixed.red)}${channel(
    base.green,
    mixed.green,
  )}${channel(base.blue, mixed.blue)}`.toUpperCase()
}

function createCityPalette(backgroundColor, darkMode) {
  const background = normalizeLightBackgroundColor(backgroundColor)

  if (darkMode) {
    return {
      skyTop: mixHexColors('#040712', background, 0.08),
      skyBottom: mixHexColors('#0B1526', background, 0.12),
      skyline: mixHexColors('#0C1728', PROMANA_PRIMARY, 0.13),
      ground: mixHexColors('#101B29', background, 0.08),
      groundEdge: mixHexColors('#070C14', PROMANA_PRIMARY, 0.1),
      park: mixHexColors('#112A29', PROMANA_PRIMARY, 0.12),
      road: '#111827',
      roadEdge: '#263246',
      sidewalk: '#526075',
      roadMark: '#90B8C4',
      water: '#63DDFF',
      building: mixHexColors('#142234', background, 0.11),
      windows: '#A8EDFF',
      windowsDim: '#3B6B79',
      label: '#08111F',
      labelText: '#F8FAFC',
      labelMuted: '#A8B7CB',
      sceneBorder: mixHexColors('#1E293B', PROMANA_PRIMARY, 0.26),
      glow: mixHexColors(PROMANA_PRIMARY, background, 0.2),
      tree: '#2B8B78',
      treeTrunk: '#6E574A',
      plaza: '#233146',
    }
  }

  return {
    skyTop: mixHexColors(background, '#FFFFFF', 0.72),
    skyBottom: mixHexColors(background, PROMANA_PRIMARY, 0.13),
    skyline: mixHexColors(background, '#FFFFFF', 0.3),
    ground: mixHexColors(background, '#F8FAFC', 0.45),
    groundEdge: mixHexColors(background, '#7697A6', 0.35),
    park: mixHexColors(background, '#B9E8D4', 0.55),
    road: mixHexColors(background, '#64748B', 0.63),
    roadEdge: mixHexColors(background, '#334155', 0.42),
    sidewalk: mixHexColors(background, '#F8FAFC', 0.72),
    roadMark: '#F8FAFC',
    water: '#31BFE8',
    building: mixHexColors(background, '#F8FAFC', 0.63),
    windows: '#DFF8FF',
    windowsDim: '#75BED1',
    label: '#FFFFFF',
    labelText: '#0F172A',
    labelMuted: '#64748B',
    sceneBorder: mixHexColors(background, PROMANA_PRIMARY, 0.36),
    glow: mixHexColors(PROMANA_PRIMARY, background, 0.18),
    tree: '#42A989',
    treeTrunk: '#83634B',
    plaza: mixHexColors(background, '#FFFFFF', 0.54),
  }
}

function getIsoPoints({ x, y, width, depth, height }) {
  const slope = 0.46
  const south = { x, y }
  const east = { x: x + width, y: y - width * slope }
  const west = { x: x - depth, y: y - depth * slope }
  const north = {
    x: x + width - depth,
    y: y - (width + depth) * slope,
  }
  const lift = (point) => ({ x: point.x, y: point.y - height })

  return {
    south,
    east,
    west,
    north,
    topSouth: lift(south),
    topEast: lift(east),
    topWest: lift(west),
    topNorth: lift(north),
  }
}

function toPoints(...points) {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function CurtainWall({
  points,
  height,
  windowColor,
  dimWindowColor,
  id,
}) {
  const { south, east, west, topSouth, topEast, topWest } = points
  const rows = Math.max(3, Math.floor(height / 24))
  const rowOffsets = Array.from(
    { length: rows },
    (_, index) => 14 + index * ((height - 24) / Math.max(1, rows - 1)),
  )

  return (
    <>
      <defs>
        <clipPath id={`${id}-right-face`}>
          <polygon points={toPoints(topSouth, topEast, east, south)} />
        </clipPath>
        <clipPath id={`${id}-left-face`}>
          <polygon points={toPoints(topSouth, topWest, west, south)} />
        </clipPath>
      </defs>

      <g
        clipPath={`url(#${id}-right-face)`}
        className="city-building__windows"
      >
        {rowOffsets.map((offset, index) => (
          <line
            key={`right-row-${offset}`}
            x1={topSouth.x + 8}
            y1={topSouth.y + offset - 4}
            x2={topEast.x - 7}
            y2={topEast.y + offset - 4}
            stroke={index % 3 === 0 ? windowColor : dimWindowColor}
            strokeWidth="7"
            strokeDasharray="12 7"
            opacity={index % 3 === 0 ? 0.9 : 0.58}
          />
        ))}
        {[0.28, 0.55, 0.8].map((fraction) => (
          <line
            key={`right-column-${fraction}`}
            x1={topSouth.x + (topEast.x - topSouth.x) * fraction}
            y1={topSouth.y + (topEast.y - topSouth.y) * fraction}
            x2={south.x + (east.x - south.x) * fraction}
            y2={south.y + (east.y - south.y) * fraction}
            stroke={dimWindowColor}
            strokeWidth="1.5"
            opacity="0.36"
          />
        ))}
      </g>

      <g
        clipPath={`url(#${id}-left-face)`}
        className="city-building__windows"
      >
        {rowOffsets.map((offset, index) => (
          <line
            key={`left-row-${offset}`}
            x1={topSouth.x - 7}
            y1={topSouth.y + offset - 4}
            x2={topWest.x + 7}
            y2={topWest.y + offset - 4}
            stroke={index % 4 === 0 ? windowColor : dimWindowColor}
            strokeWidth="7"
            strokeDasharray="10 7"
            opacity={index % 4 === 0 ? 0.88 : 0.55}
          />
        ))}
        {[0.34, 0.68].map((fraction) => (
          <line
            key={`left-column-${fraction}`}
            x1={topSouth.x + (topWest.x - topSouth.x) * fraction}
            y1={topSouth.y + (topWest.y - topSouth.y) * fraction}
            x2={south.x + (west.x - south.x) * fraction}
            y2={south.y + (west.y - south.y) * fraction}
            stroke={dimWindowColor}
            strokeWidth="1.5"
            opacity="0.34"
          />
        ))}
      </g>
    </>
  )
}

function BuildingAdornment({
  variant,
  points,
  accent,
  palette,
  height,
}) {
  const {
    south,
    west,
    topSouth,
    topEast,
    topWest,
    topNorth,
  } = points
  const roofCenter = {
    x: (topSouth.x + topEast.x + topWest.x + topNorth.x) / 4,
    y: (topSouth.y + topEast.y + topWest.y + topNorth.y) / 4,
  }

  if (variant === 'spire') {
    return (
      <g className="city-spire">
        <polygon
          points={toPoints(
            { x: roofCenter.x, y: roofCenter.y - 50 },
            topEast,
            topSouth,
            topWest,
          )}
          fill={mixHexColors(accent, '#FFFFFF', 0.2)}
          opacity="0.94"
        />
        <line
          x1={roofCenter.x}
          y1={roofCenter.y - 50}
          x2={roofCenter.x}
          y2={roofCenter.y - 90}
          stroke={accent}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle
          className="city-spire__beacon"
          cx={roofCenter.x}
          cy={roofCenter.y - 94}
          r="5"
          fill="#FFFFFF"
          stroke={accent}
          strokeWidth="3"
        />
      </g>
    )
  }

  if (variant === 'antenna') {
    return (
      <g>
        <line
          x1={roofCenter.x}
          y1={roofCenter.y}
          x2={roofCenter.x}
          y2={roofCenter.y - 30}
          stroke={accent}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d={`M ${roofCenter.x - 17} ${roofCenter.y - 31} Q ${roofCenter.x} ${
            roofCenter.y - 48
          } ${roofCenter.x + 17} ${roofCenter.y - 31}`}
          fill="none"
          stroke={palette.windows}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx={roofCenter.x}
          cy={roofCenter.y - 31}
          r="4"
          fill={accent}
        />
      </g>
    )
  }

  if (variant === 'clock') {
    const clockCenter = {
      x: topSouth.x + (topWest.x - topSouth.x) * 0.5,
      y: topSouth.y + height * 0.24 + (topWest.y - topSouth.y) * 0.5,
    }

    return (
      <g className="city-clock">
        <circle
          cx={clockCenter.x}
          cy={clockCenter.y}
          r="15"
          fill={palette.label}
          stroke={accent}
          strokeWidth="4"
        />
        <line
          x1={clockCenter.x}
          y1={clockCenter.y}
          x2={clockCenter.x}
          y2={clockCenter.y - 8}
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1={clockCenter.x}
          y1={clockCenter.y}
          x2={clockCenter.x + 6}
          y2={clockCenter.y + 3}
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    )
  }

  if (variant === 'projects') {
    return (
      <g>
        <rect
          x={topNorth.x + 17}
          y={topNorth.y - 27}
          width="8"
          height="31"
          rx="3"
          fill={accent}
        />
        <rect
          x={topNorth.x + 33}
          y={topNorth.y - 40}
          width="8"
          height="43"
          rx="3"
          fill={mixHexColors(accent, PROMANA_SECONDARY, 0.25)}
        />
        <rect
          x={topNorth.x + 49}
          y={topNorth.y - 20}
          width="8"
          height="22"
          rx="3"
          fill={palette.windows}
        />
      </g>
    )
  }

  if (variant === 'tasks') {
    const markX = south.x + (west.x - south.x) * 0.52
    const markY = topSouth.y + height * 0.32

    return (
      <g>
        <circle
          cx={markX}
          cy={markY}
          r="16"
          fill={palette.label}
          stroke={accent}
          strokeWidth="3"
        />
        <path
          d={`M ${markX - 8} ${markY} l 5 6 l 11 -13`}
          fill="none"
          stroke={accent}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    )
  }

  if (variant === 'notes') {
    return (
      <g opacity="0.9">
        {[0.3, 0.48, 0.66].map((fraction) => (
          <line
            key={fraction}
            x1={topSouth.x - 4}
            y1={topSouth.y + height * fraction}
            x2={topWest.x + 6}
            y2={topWest.y + height * fraction}
            stroke={accent}
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}
      </g>
    )
  }

  return null
}

function CityBuilding({
  building,
  palette,
  isActive,
  stat,
  onSelect,
  animationIndex,
}) {
  const details = WORKSPACE_DETAILS[building.id]
  const accent = details.accent
  const points = getIsoPoints(building)
  const topY = Math.min(
    points.topSouth.y,
    points.topEast.y,
    points.topWest.y,
    points.topNorth.y,
  )
  const centerX =
    (points.topSouth.x +
      points.topEast.x +
      points.topWest.x +
      points.topNorth.x) /
    4
  const baseColor = mixHexColors(
    palette.building,
    accent,
    isActive ? 0.38 : 0.23,
  )
  const rightColor = mixHexColors(baseColor, '#08192B', 0.24)
  const leftColor = mixHexColors(baseColor, '#FFFFFF', 0.08)
  const roofColor = mixHexColors(baseColor, accent, 0.48)
  const labelWidth = 148
  const labelY = topY - 44
  const hitX = Math.min(points.west.x, points.topWest.x) - 18
  const hitWidth =
    Math.max(points.east.x, points.topEast.x) - hitX + 18
  const hitY = labelY - 6

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(building.id)
    }
  }

  return (
    <g
      className={`city-building${isActive ? ' city-building--active' : ''}`}
      role="button"
      tabIndex="0"
      aria-label={`Enter ${details.label}. ${stat}.`}
      onClick={() => onSelect(building.id)}
      onKeyDown={handleKeyDown}
      style={{
        '--city-building-delay': `${animationIndex * 90}ms`,
        '--city-accent': accent,
      }}
    >
      <title>{`Enter ${details.buildingName} — ${stat}`}</title>
      <rect
        className="city-building__hit"
        x={hitX}
        y={hitY}
        width={hitWidth}
        height={building.y - hitY + 18}
        rx="20"
        fill="transparent"
      />

      {isActive ? (
        <ellipse
          className="city-building__halo"
          cx={building.x + (building.width - building.depth) / 2}
          cy={building.y + 5}
          rx={(building.width + building.depth) * 0.72}
          ry="28"
          fill={accent}
          opacity="0.26"
        />
      ) : null}

      <polygon
        points={toPoints(
          { x: points.south.x, y: points.south.y + 8 },
          { x: points.east.x + 8, y: points.east.y + 4 },
          { x: points.north.x, y: points.north.y - 4 },
          { x: points.west.x - 8, y: points.west.y + 4 },
        )}
        fill={palette.groundEdge}
        opacity="0.75"
      />
      <polygon
        className="city-building__face city-building__face--right"
        points={toPoints(
          points.topSouth,
          points.topEast,
          points.east,
          points.south,
        )}
        fill={rightColor}
        stroke={mixHexColors(rightColor, accent, 0.32)}
        strokeWidth="1.5"
      />
      <polygon
        className="city-building__face city-building__face--left"
        points={toPoints(
          points.topSouth,
          points.topWest,
          points.west,
          points.south,
        )}
        fill={leftColor}
        stroke={mixHexColors(leftColor, accent, 0.3)}
        strokeWidth="1.5"
      />
      <polygon
        className="city-building__roof"
        points={toPoints(
          points.topSouth,
          points.topEast,
          points.topNorth,
          points.topWest,
        )}
        fill={roofColor}
        stroke={mixHexColors(roofColor, '#FFFFFF', 0.28)}
        strokeWidth="2"
      />

      <CurtainWall
        points={points}
        height={building.height}
        windowColor={palette.windows}
        dimWindowColor={palette.windowsDim}
        id={`city-${building.id}`}
      />
      <BuildingAdornment
        variant={building.variant}
        points={points}
        accent={accent}
        palette={palette}
        height={building.height}
      />

      <g
        className="city-building__label"
        transform={`translate(${centerX - labelWidth / 2} ${labelY})`}
        pointerEvents="none"
      >
        <rect
          width={labelWidth}
          height="34"
          rx="17"
          fill={palette.label}
          stroke={isActive ? accent : palette.sceneBorder}
          strokeWidth={isActive ? 3 : 1.5}
          opacity="0.97"
        />
        <circle cx="18" cy="17" r="5" fill={accent} />
        <text
          x="30"
          y="21"
          fill={palette.labelText}
          fontSize="13"
          fontWeight="800"
        >
          {details.label}
        </text>
        <text
          x={labelWidth - 12}
          y="21"
          fill={palette.labelMuted}
          fontSize="10"
          fontWeight="700"
          textAnchor="end"
        >
          {stat.split(' ')[0]}
        </text>
      </g>
    </g>
  )
}

function Tree({ x, y, palette, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="8" rx="17" ry="6" fill="#000000" opacity="0.12" />
      <rect x="-3" y="-14" width="6" height="23" rx="3" fill={palette.treeTrunk} />
      <circle cx="0" cy="-20" r="15" fill={palette.tree} />
      <circle cx="-8" cy="-15" r="9" fill={mixHexColors(palette.tree, '#FFFFFF', 0.12)} />
      <circle cx="8" cy="-14" r="10" fill={mixHexColors(palette.tree, PROMANA_PRIMARY, 0.17)} />
    </g>
  )
}

const ROAD_VEHICLES = [
  {
    id: 'cyan-car',
    type: 'car',
    direction: 'east',
    color: '#22B8CF',
    duration: '17s',
    delay: '-1s',
  },
  {
    id: 'violet-car',
    type: 'car',
    direction: 'west',
    color: PROMANA_SECONDARY,
    duration: '18s',
    delay: '-8s',
  },
  {
    id: 'orange-car',
    type: 'car',
    direction: 'east',
    color: '#F97316',
    duration: '19s',
    delay: '-13s',
  },
  {
    id: 'pink-car',
    type: 'car',
    direction: 'west',
    color: '#EC4899',
    duration: '16s',
    delay: '-4s',
  },
  {
    id: 'blue-bus',
    type: 'bus',
    direction: 'east',
    color: '#2563EB',
    duration: '23s',
    delay: '-17s',
  },
  {
    id: 'green-bus',
    type: 'bus',
    direction: 'west',
    color: '#0D9488',
    duration: '25s',
    delay: '-11s',
  },
]

function RoadVehicle({ type, direction, color, duration, delay }) {
  const isBus = type === 'bus'
  const width = isBus ? 38 : 23
  const height = isBus ? 14 : 10
  const x = direction === 'east' ? 105 : 1062
  const y = direction === 'east' ? 410 : 557
  const lightX = direction === 'east' ? x + width - 2 : x + 2

  return (
    <g
      className={`city-traffic city-traffic--${direction}`}
      style={{
        '--city-traffic-duration': duration,
        '--city-traffic-delay': delay,
      }}
    >
      <ellipse
        cx={x + width / 2}
        cy={y + height + 3}
        rx={width * 0.56}
        ry="3"
        fill="#000000"
        opacity="0.18"
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={isBus ? 3 : 4}
        fill={color}
        stroke="#FFFFFF"
        strokeWidth="1"
      />

      {isBus ? (
        <>
          {[5, 13, 21, 29].map((windowOffset) => (
            <rect
              key={windowOffset}
              x={x + windowOffset}
              y={y + 2}
              width="6"
              height="5"
              rx="1"
              fill="#DDF7FF"
              opacity="0.92"
            />
          ))}
          <rect
            x={x + 3}
            y={y + 9}
            width={width - 6}
            height="2"
            rx="1"
            fill="#FFFFFF"
            opacity="0.65"
          />
        </>
      ) : (
        <>
          <path
            d={`M ${x + 5} ${y} L ${x + 9} ${y - 4} H ${
              x + width - 7
            } L ${x + width - 3} ${y} Z`}
            fill={mixHexColors(color, '#FFFFFF', 0.22)}
            stroke="#FFFFFF"
            strokeWidth="0.8"
          />
          <rect
            x={x + 9}
            y={y - 3}
            width={width - 16}
            height="3"
            rx="1"
            fill="#DDF7FF"
          />
        </>
      )}

      <circle cx={x + 6} cy={y + height} r="3" fill="#111827" />
      <circle cx={x + width - 6} cy={y + height} r="3" fill="#111827" />
      <circle cx={lightX} cy={y + height * 0.56} r="1.8" fill="#FFF7B2" />
    </g>
  )
}

function RoadTraffic() {
  return (
    <g aria-hidden="true">
      {ROAD_VEHICLES.map((vehicle) => (
        <RoadVehicle key={vehicle.id} {...vehicle} />
      ))}
    </g>
  )
}

function Fountain({ palette }) {
  const brightWater = mixHexColors(palette.water, '#FFFFFF', 0.34)

  return (
    <g className="city-fountain" aria-hidden="true">
      <ellipse
        cx="654"
        cy="436"
        rx="47"
        ry="22"
        fill="#000000"
        opacity="0.13"
      />
      <ellipse
        cx="654"
        cy="431"
        rx="43"
        ry="21"
        fill={mixHexColors(palette.plaza, '#FFFFFF', 0.18)}
        stroke={palette.sceneBorder}
        strokeWidth="3"
      />
      <ellipse
        cx="654"
        cy="429"
        rx="35"
        ry="16"
        fill={mixHexColors(palette.water, palette.plaza, 0.22)}
        stroke={palette.water}
        strokeWidth="3"
      />
      <ellipse
        className="city-fountain__ripple city-fountain__ripple--outer"
        cx="654"
        cy="429"
        rx="25"
        ry="10"
        fill="none"
        stroke={brightWater}
        strokeWidth="2"
      />
      <ellipse
        className="city-fountain__ripple city-fountain__ripple--inner"
        cx="654"
        cy="429"
        rx="13"
        ry="5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />

      <rect
        x="650"
        y="407"
        width="8"
        height="19"
        rx="3"
        fill={mixHexColors(palette.sceneBorder, '#FFFFFF', 0.18)}
      />
      <ellipse
        cx="654"
        cy="407"
        rx="8"
        ry="4"
        fill={palette.water}
        stroke={brightWater}
        strokeWidth="2"
      />
      <ellipse
        cx="654"
        cy="426"
        rx="11"
        ry="5"
        fill={mixHexColors(palette.sceneBorder, '#FFFFFF', 0.12)}
      />

      <path
        className="city-fountain__jet city-fountain__jet--left"
        d="M653 408 Q640 378 626 424"
        fill="none"
        stroke={brightWater}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        className="city-fountain__jet city-fountain__jet--center"
        d="M654 407 Q654 367 654 391"
        fill="none"
        stroke={brightWater}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        className="city-fountain__jet city-fountain__jet--right"
        d="M655 408 Q669 378 682 424"
        fill="none"
        stroke={brightWater}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle
        className="city-fountain__drop city-fountain__drop--one"
        cx="637"
        cy="393"
        r="3"
        fill="#FFFFFF"
      />
      <circle
        className="city-fountain__drop city-fountain__drop--two"
        cx="672"
        cy="395"
        r="2.5"
        fill="#FFFFFF"
      />
    </g>
  )
}

function SubwayEntrance({ palette }) {
  const metal = mixHexColors(palette.sidewalk, '#334155', 0.32)

  return (
    <g className="city-subway" aria-hidden="true">
      <ellipse cx="530" cy="623" rx="64" ry="18" fill="#000000" opacity="0.14" />
      <polygon
        points="472,598 528,570 590,600 533,629"
        fill={palette.sidewalk}
        stroke={palette.sceneBorder}
        strokeWidth="2.5"
      />
      <polygon
        points="489,598 528,579 572,600 532,620"
        fill="#030712"
        stroke={metal}
        strokeWidth="3"
      />
      <polygon
        points="501,597 528,584 558,599 531,613"
        fill={mixHexColors(palette.road, '#FFFFFF', 0.1)}
      />
      {[0, 1, 2, 3].map((step) => (
        <line
          key={step}
          className="city-subway__step"
          x1={502 + step * 7}
          y1={600 + step * 3}
          x2={548 + step * 2}
          y2={593 + step * 5}
          stroke={step === 0 ? palette.water : metal}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ '--city-step-delay': `${step * 160}ms` }}
        />
      ))}

      <path
        d="M486 597 V570 M486 570 L512 557 M512 557 V584"
        fill="none"
        stroke={metal}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M551 587 V561 M551 561 L572 572 M572 572 V600"
        fill="none"
        stroke={metal}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M483 569 L512 555 L555 576 L573 568"
        fill="none"
        stroke={palette.water}
        strokeWidth="3"
        strokeLinecap="round"
      />

      <line
        x1="475"
        y1="591"
        x2="475"
        y2="548"
        stroke={metal}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle
        className="city-subway__sign"
        cx="475"
        cy="541"
        r="14"
        fill={PROMANA_PRIMARY}
        stroke="#FFFFFF"
        strokeWidth="3"
      />
      <text
        x="475"
        y="546"
        fill="#FFFFFF"
        fontSize="13"
        fontWeight="900"
        textAnchor="middle"
      >
        M
      </text>
      <g transform="translate(492 622)">
        <rect
          width="73"
          height="20"
          rx="10"
          fill={palette.label}
          stroke={palette.sceneBorder}
          strokeWidth="1.5"
        />
        <circle cx="12" cy="10" r="4" fill={PROMANA_PRIMARY} />
        <text
          x="22"
          y="14"
          fill={palette.labelText}
          fontSize="10"
          fontWeight="900"
          letterSpacing="1"
        >
          METRO
        </text>
      </g>
    </g>
  )
}

const COMMUTERS = [
  {
    route: 'projects',
    color: '#2563EB',
    skinTone: '#D89B72',
    delay: '-2s',
  },
  {
    route: 'launchpad',
    color: '#F97316',
    skinTone: '#8D5524',
    delay: '-6.5s',
  },
  {
    route: 'ai',
    color: PROMANA_SECONDARY,
    skinTone: '#F0B78B',
    delay: '-9s',
  },
  {
    route: 'tasks',
    color: '#0D9488',
    skinTone: '#C68642',
    delay: '-4s',
  },
  {
    route: 'calendar',
    color: '#DB2777',
    skinTone: '#F1C27D',
    delay: '-11.5s',
  },
]

function CityPerson({ route, color, skinTone, delay }) {
  return (
    <g
      className={`city-commuter city-commuter--${route}`}
      style={{ '--city-person-delay': delay }}
    >
      <ellipse cx="0" cy="4" rx="6" ry="2.5" fill="#000000" opacity="0.2" />
      <g className="city-person__walker">
        <circle
          cx="0"
          cy="-14"
          r="4"
          fill={skinTone}
          stroke="#FFFFFF"
          strokeWidth="0.8"
        />
        <line
          x1="0"
          y1="-10"
          x2="0"
          y2="-2"
          stroke={color}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <line
          className="city-person__arm city-person__arm--left"
          x1="-1"
          y1="-8"
          x2="-6"
          y2="-3"
          stroke={skinTone}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <line
          className="city-person__arm city-person__arm--right"
          x1="1"
          y1="-8"
          x2="6"
          y2="-4"
          stroke={skinTone}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <line
          className="city-person__leg city-person__leg--left"
          x1="-1"
          y1="-2"
          x2="-5"
          y2="4"
          stroke="#182235"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <line
          className="city-person__leg city-person__leg--right"
          x1="1"
          y1="-2"
          x2="5"
          y2="4"
          stroke="#182235"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <rect
          className="city-person__bag"
          x="5"
          y="-5"
          width="5"
          height="6"
          rx="1"
          fill="#172033"
          stroke="#FFFFFF"
          strokeWidth="0.5"
        />
      </g>
    </g>
  )
}

function CityCommuters() {
  return (
    <g className="city-commuters" aria-hidden="true">
      {COMMUTERS.map((commuter) => (
        <CityPerson key={commuter.route} {...commuter} />
      ))}
    </g>
  )
}

export default function CityDashboard({
  activeWorkspace,
  onSelectWorkspace,
  darkMode,
  lightBackgroundColor,
  projectCount,
  launchpadCount,
  noteCount,
  taskGroupCount,
  calendarCount,
}) {
  const sceneFrameRef = useRef(null)
  const palette = createCityPalette(lightBackgroundColor, darkMode)
  const stats = {
    projects: `${projectCount} project${projectCount === 1 ? '' : 's'}`,
    launchpad: `${launchpadCount} shortcut${launchpadCount === 1 ? '' : 's'}`,
    notes: `${noteCount} note${noteCount === 1 ? '' : 's'}`,
    tasks: `${taskGroupCount} group${taskGroupCount === 1 ? '' : 's'}`,
    calendar: `${calendarCount} target${calendarCount === 1 ? '' : 's'}`,
    ai: 'AI online',
  }
  const selectedWorkspace =
    WORKSPACE_DETAILS[activeWorkspace] ?? WORKSPACE_DETAILS.projects
  const SelectedIcon = selectedWorkspace.icon

  useEffect(() => {
    const sceneFrame = sceneFrameRef.current
    const activeBuilding = BUILDING_LAYOUT.find(
      (building) => building.id === activeWorkspace,
    )

    if (
      !sceneFrame ||
      !activeBuilding ||
      sceneFrame.scrollWidth <= sceneFrame.clientWidth
    ) {
      return
    }

    const activeBuildingCenter =
      ((activeBuilding.x + (activeBuilding.width - activeBuilding.depth) / 2) /
        1200) *
      sceneFrame.scrollWidth
    const targetScrollLeft = Math.max(
      0,
      activeBuildingCenter - sceneFrame.clientWidth / 2,
    )

    sceneFrame.scrollTo({
      left: targetScrollLeft,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }, [activeWorkspace])

  return (
    <section
      className="city-dashboard overflow-hidden rounded-[2rem] border shadow-2xl"
      style={{
        '--city-primary': PROMANA_PRIMARY,
        '--city-secondary': PROMANA_SECONDARY,
        '--city-scene-border': palette.sceneBorder,
        '--city-label': palette.label,
        '--city-label-text': palette.labelText,
        borderColor: palette.sceneBorder,
      }}
      aria-labelledby="city-dashboard-title"
    >
      <div className="relative z-10 grid gap-5 border-b border-white/20 bg-white/65 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-md shadow-cyan-500/20">
              <Building2 className="h-3.5 w-3.5" />
              City mode
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-violet-500" />
              6 live workspaces
            </span>
          </div>
          <h1
            id="city-dashboard-title"
            className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl"
          >
            Your work has an address.
          </h1>
          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
            Explore ProMana City and enter a building to open its workspace.
            The architecture follows your background color and shifts to a
            luminous night skyline in dark mode.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelectWorkspace(activeWorkspace)}
          className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/80 bg-white/85 p-3 text-left shadow-lg shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:shadow-black/20 dark:hover:border-cyan-400/40 sm:min-w-80"
        >
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${selectedWorkspace.accent}, ${mixHexColors(
                selectedWorkspace.accent,
                PROMANA_SECONDARY,
                0.36,
              )})`,
            }}
          >
            <SelectedIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[0.17em] text-slate-400 dark:text-slate-500">
              Selected building
            </span>
            <span className="mt-0.5 block truncate text-sm font-black text-slate-900 dark:text-white">
              {selectedWorkspace.buildingName}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {stats[activeWorkspace]}
            </span>
          </span>
          <ArrowDown className="h-4 w-4 shrink-0 text-cyan-600 transition group-hover:translate-y-1 dark:text-cyan-300" />
        </button>
      </div>

      <div
        ref={sceneFrameRef}
        className="city-scene-frame relative overflow-x-auto"
        style={{
          background: `linear-gradient(180deg, ${palette.skyTop}, ${palette.skyBottom})`,
        }}
      >
        <svg
          className="city-scene block h-auto min-h-[31rem] w-full min-w-[780px]"
          viewBox="0 0 1200 720"
          role="img"
          aria-labelledby="city-scene-title city-scene-description"
        >
          <title id="city-scene-title">Interactive ProMana City</title>
          <desc id="city-scene-description">
            An animated isometric city with one interactive building for each
            ProMana workspace, a central fountain, a metro entrance, moving
            traffic, and commuters walking toward their offices.
          </desc>
          <defs>
            <linearGradient id="city-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.skyTop} />
              <stop offset="100%" stopColor={palette.skyBottom} />
            </linearGradient>
            <radialGradient id="city-atmosphere">
              <stop offset="0%" stopColor={PROMANA_PRIMARY} stopOpacity="0.26" />
              <stop offset="100%" stopColor={PROMANA_PRIMARY} stopOpacity="0" />
            </radialGradient>
            <clipPath id="city-platform-clip">
              <polygon points="600,202 1140,466 600,698 60,466" />
            </clipPath>
            <filter id="city-soft-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow
                dx="0"
                dy="16"
                stdDeviation="14"
                floodColor={darkMode ? '#000000' : '#31475B'}
                floodOpacity={darkMode ? '0.45' : '0.22'}
              />
            </filter>
          </defs>

          <rect width="1200" height="720" fill="url(#city-sky)" />
          <ellipse
            cx="690"
            cy="165"
            rx="390"
            ry="220"
            fill="url(#city-atmosphere)"
          />

          {darkMode ? (
            <g className="city-stars" fill="#FFFFFF">
              {[
                [92, 84, 2],
                [172, 145, 1.5],
                [256, 66, 2.2],
                [384, 126, 1.4],
                [525, 55, 1.8],
                [784, 65, 1.4],
                [945, 110, 2.1],
                [1092, 78, 1.6],
                [1144, 170, 1.2],
              ].map(([x, y, radius]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r={radius} opacity="0.74" />
              ))}
            </g>
          ) : (
            <circle
              cx="1010"
              cy="112"
              r="42"
              fill="#FFF8D8"
              opacity="0.78"
            />
          )}

          <g className="city-cloud city-cloud--one" opacity={darkMode ? 0.16 : 0.48}>
            <ellipse cx="135" cy="145" rx="56" ry="18" fill="#FFFFFF" />
            <circle cx="112" cy="132" r="23" fill="#FFFFFF" />
            <circle cx="151" cy="128" r="29" fill="#FFFFFF" />
          </g>
          <g className="city-cloud city-cloud--two" opacity={darkMode ? 0.12 : 0.36}>
            <ellipse cx="955" cy="205" rx="52" ry="16" fill="#FFFFFF" />
            <circle cx="935" cy="193" r="21" fill="#FFFFFF" />
            <circle cx="970" cy="188" r="26" fill="#FFFFFF" />
          </g>

          <g className="city-background-skyline" fill={palette.skyline} opacity="0.72">
            <path d="M0 320H70V238H105V320H142V203H184V320H225V255H268V320H314V220H350V320H0Z" />
            <path d="M880 320H914V225H950V320H980V184H1025V320H1060V242H1098V320H1130V208H1173V320H1200V350H880Z" />
          </g>

          <g filter="url(#city-soft-shadow)">
            <polygon
              points="600,218 1140,482 600,716 60,482"
              fill={palette.groundEdge}
            />
            <polygon
              points="600,202 1140,466 600,698 60,466"
              fill={palette.ground}
              stroke={palette.sceneBorder}
              strokeWidth="3"
            />

            <g clipPath="url(#city-platform-clip)">
              {[
                'M110 421 L620 510 L1095 555',
              ].map((roadPath) => (
                <g key={roadPath}>
                  <path
                    d={roadPath}
                    fill="none"
                    stroke={palette.roadEdge}
                    strokeWidth="82"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={roadPath}
                    fill="none"
                    stroke={palette.sidewalk}
                    strokeWidth="72"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={roadPath}
                    fill="none"
                    stroke={palette.road}
                    strokeWidth="58"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}

              <path
                d="M110 421 L620 510 L1095 555"
                fill="none"
                stroke={palette.roadMark}
                strokeWidth="4"
                strokeDasharray="26 20"
                opacity="0.72"
              />
              <RoadTraffic />
            </g>

            <polygon
              points="570,430 654,390 738,432 653,474"
              fill={palette.plaza}
              stroke={palette.sceneBorder}
              strokeWidth="3"
            />
            <Fountain palette={palette} />

            <polygon
              points="456,420 520,389 568,413 504,445"
              fill={palette.park}
              stroke={palette.sceneBorder}
              strokeWidth="2"
            />
            <polygon
              points="932,470 1032,421 1100,455 999,504"
              fill={palette.park}
              stroke={palette.sceneBorder}
              strokeWidth="2"
            />

            <Tree x={487} y={417} palette={palette} scale={0.68} />
            <Tree x={525} y={411} palette={palette} scale={0.62} />
            <Tree x={984} y={464} palette={palette} scale={0.76} />
            <Tree x={1036} y={456} palette={palette} scale={0.68} />

            <SubwayEntrance palette={palette} />
            <CityCommuters />

            {BUILDING_LAYOUT.map((building, index) => (
              <CityBuilding
                key={building.id}
                building={building}
                palette={palette}
                isActive={activeWorkspace === building.id}
                stat={stats[building.id]}
                onSelect={onSelectWorkspace}
                animationIndex={index}
              />
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/70 px-3 py-2 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
          <MousePointer2 className="h-3.5 w-3.5 text-cyan-300" />
          Click a building to enter
        </div>
      </div>

      <nav
        className="grid gap-2 border-t border-white/20 bg-white/75 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 sm:grid-cols-2 sm:p-4 lg:grid-cols-6"
        aria-label="City workspace directory"
      >
        {Object.entries(WORKSPACE_DETAILS).map(([workspaceId, details]) => {
          const Icon = details.icon
          const isActive = workspaceId === activeWorkspace

          return (
            <button
              key={workspaceId}
              type="button"
              onClick={() => onSelectWorkspace(workspaceId)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 ${
                isActive
                  ? 'border-cyan-400/50 bg-cyan-50 shadow-sm dark:border-cyan-400/30 dark:bg-cyan-400/10'
                  : 'border-transparent hover:border-slate-200 hover:bg-white/70 dark:hover:border-white/10 dark:hover:bg-white/5'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                style={{ backgroundColor: details.accent }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-slate-800 dark:text-slate-100">
                  {details.label}
                </span>
                <span className="block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {stats[workspaceId]}
                </span>
              </span>
            </button>
          )
        })}
      </nav>
    </section>
  )
}
