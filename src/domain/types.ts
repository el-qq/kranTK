/** Состояние крана «крупными мазками» — используется для чипов и точек в списках. */
export type CraneStatus = 'work' | 'alarm' | 'warn' | 'idle' | 'off'

/** Режим работы в конкретный момент времени. */
export type WorkMode = 'off' | 'warmup' | 'idle' | 'noload' | 'load'

/** Оценка безопасности в конкретный момент времени. */
export type Severity = 'offline' | 'idle' | 'ok' | 'warn' | 'alarm'

/** Состояние подсистемы (CAN, GPS, датчики, связь). */
export type SysState = 'ok' | 'warn' | 'error' | 'none'

export interface Coords {
  lat: number
  lon: number
}

/** Мгновенные значения на DEMO_NOW — «якорь», к которому сходится генератор. */
export interface CraneCurrent {
  mode: WorkMode
  loadPct: number | null
  massT: number
  allowedT: number
  boomAngleDeg: number
  boomLenM: number
  radiusM: number
  heightM: number
  azimuthDeg: number
  rpm: number
  oilTempC: number
  coolantTempC: number
  hydPressureKpa: number
  hydOilTempC: number
  fuelPct: number
  voltageV: number
  tiltXDeg: number
  tiltYDeg: number
}

/** Итоги смены на DEMO_NOW. */
export interface CraneShift {
  workMin: number
  idleMin: number
  cycles: number
  liftedT: number
  overloads: number
  maxLoadPct: number | null
  avgCycleSec: number
}

/** Паспорт и «железо». */
export interface CranePassport {
  capacityT: number
  maxBoomM: number
  maxHeightM: number
  outriggers: string
  counterweightT: number
  totalHours: number
  totalCycles: number
  calibration: string
  serviceInHours: number
}

export interface CraneSystems {
  can: SysState
  gps: SysState
  angle: SysState
  pressure: SysState
  link: SysState
  gsmDbm: number | null
  satellites: number | null
  trackPoints: number
}

export interface Crane {
  id: string
  name: string
  brand: string
  plate: string
  status: CraneStatus
  operator: string
  place: string
  coords: Coords
  tempC: number
  windMs: number
  weather: string
  visibility: string
  lastSeen: string
  /** Минута суток последнего контакта; null — кран на связи. */
  lastSeenMin: number | null
  passport: CranePassport
  current: CraneCurrent
  shift: CraneShift
  systems: CraneSystems
  /** Позиция маркера на схематичной карте парка, % от размеров контейнера. */
  mapXY: [number, number]
}

/** Одна точка телеметрии. */
export interface Sample {
  /** Абсолютное время, мс. */
  ts: number
  /** Минута суток 0..1439 (для суточных шкал). */
  min: number
  mode: WorkMode
  severity: Severity
  online: boolean
  loadPct: number | null
  massT: number
  allowedT: number
  boomAngleDeg: number
  boomLenM: number
  radiusM: number
  heightM: number
  azimuthDeg: number
  rpm: number
  oilTempC: number
  coolantTempC: number
  hydPressureKpa: number
  hydOilTempC: number
  fuelPct: number
  voltageV: number
  tiltXDeg: number
  tiltYDeg: number
  /** Накопительно с начала суток. */
  cyclesDone: number
  workMin: number
  idleMin: number
  liftedT: number
  overloads: number
}

/** Однородный отрезок суток — строка таблицы «Интервалы работы». */
export interface Interval {
  fromMin: number
  toMin: number
  mode: WorkMode
  severity: Severity
  label: string
  cycles: number
  maxLoadPct: number | null
  event: string
}

export interface TimelineEvent {
  ts: number
  min: number
  kind: string
  text: string
  severity: Severity
}

/** Готовый суточный набор для одного крана. */
export interface DayData {
  craneId: string
  dateKey: string
  samples: Sample[]
  intervals: Interval[]
  events: TimelineEvent[]
  /** Минута суток, после которой данных ещё нет (для «сегодня»). */
  cutoffMin: number
}
