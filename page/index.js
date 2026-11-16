// ScreenCalib 1.0.0 - калибровка экрана Amazfit Bip Max (Zepp OS)
// Все координаты в обычных пикселях экрана (px() не используется).
// Правый и нижний края - координата ПЕРВОГО пикселя за областью
// (ширина = п - л, высота = н - в).

import * as ui from '@zos/ui'
import * as dev from '@zos/device'
import * as util from '@zos/utils'
import * as display from '@zos/display'

const createWidget = ui.createWidget
const widget = ui.widget
const prop = ui.prop
const align = ui.align

const MIN = 40 // минимальный размер области
const INSET = 20 // стартовый отступ рабочей области

const C = {
  GREEN: 0x2ecc71,
  GRID: 0x1e9e50,
  GRID50: 0x0b6b30,
  LABEL: 0x00300f,
  S_EDGE: 0xff1744,
  S_CENTER: 0xffffff,
  A_CENTER: 0xffd600,
  TICK: 0xff00ff,
  HL: 0xff9100,
  BLACK: 0x000000,
  WHITE: 0xffffff,
  YELLOW: 0xffd600,
  CYAN: 0x4dd0e1,
  BTN: 0x333333,
  BTN_P: 0x666666,
  BTN5: 0x1f4fa3,
  BTN5_P: 0x3d73d6,
  ON: 0xe67e00,
  ON_P: 0xff9d2e,
  OFF: 0x2b2b2b,
  OFF_P: 0x555555
}

function readInfo() {
  try {
    return dev.getDeviceInfo() || {}
  } catch (e) {
    return {}
  }
}
const INFO = readInfo()
const W = INFO.width > 0 ? INFO.width : 432
const H = INFO.height > 0 ? INFO.height : 514

// S - область экрана (то, что реально видно), A - рабочая (чёрная) область
const S = { l: 0, t: 0, r: W, b: H }
const A = { l: INSET, t: INSET, r: W - INSET, b: H - INSET }

let mode = 0 // 0 - правим экран, 1 - правим рабочую область
let target = 4 // 0 лев, 1 верх, 2 прав, 3 низ, 4 вся рамка

const w = {} // ссылки на виджеты

// ---------- помощники ----------
function R(color, x, y, ww, hh) {
  return createWidget(widget.FILL_RECT, { x: x, y: y, w: ww, h: hh, color: color })
}
function dyn(color) {
  return R(color, W + 5, H + 5, 1, 1)
}
function RR(color, x, y, ww, hh, radius) {
  return createWidget(widget.FILL_RECT, { x: x, y: y, w: ww, h: hh, color: color, radius: radius })
}
function T(text, x, y, ww, hh, size, color, ah) {
  return createWidget(widget.TEXT, {
    x: x, y: y, w: ww, h: hh,
    text: text, text_size: size, color: color,
    align_h: ah === undefined ? align.CENTER_H : ah,
    align_v: align.CENTER_V
  })
}
function B(text, x, y, ww, hh, size, nc, pc, fn) {
  return createWidget(widget.BUTTON, {
    x: x, y: y, w: ww, h: hh,
    text: text, text_size: size, color: C.WHITE,
    normal_color: nc, press_color: pc, radius: 10,
    click_func: fn
  })
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}
function setR(wd, x, y, ww, hh) {
  if (ww < 1 || hh < 1) {
    x = W + 5
    y = H + 5
    ww = 1
    hh = 1
  }
  try {
    wd.setProperty(prop.MORE, { x: x, y: y, w: ww, h: hh })
  } catch (e) {}
}
function setTxt(wd, s) {
  try {
    wd.setProperty(prop.TEXT, s)
  } catch (e) {}
}
function setBtn(wd, on) {
  try {
    wd.setProperty(prop.MORE, {
      normal_color: on ? C.ON : C.OFF,
      press_color: on ? C.ON_P : C.OFF_P
    })
  } catch (e) {}
}
// центральная линия: чётная ширина -> толщина te, нечётная -> to (всегда симметрично)
function centerLine(l, r, te, to) {
  if ((r - l) % 2 === 0) {
    return [(l + r) / 2 - te / 2, te]
  }
  return [(l + r - 1) / 2 - (to - 1) / 2, to]
}
function edgeRect(Q, i, th) {
  if (i === 0) return [Q.l, Q.t, th, Q.b - Q.t]
  if (i === 1) return [Q.l, Q.t, Q.r - Q.l, th]
  if (i === 2) return [Q.r - th, Q.t, th, Q.b - Q.t]
  return [Q.l, Q.b - th, Q.r - Q.l, th]
}

// ---------- логика ----------
function fitA() {
  A.l = Math.max(A.l, S.l)
  A.t = Math.max(A.t, S.t)
  A.r = Math.min(A.r, S.r)
  A.b = Math.min(A.b, S.b)
  if (A.r - A.l < MIN) A.r = Math.min(S.r, A.l + MIN)
  if (A.b - A.t < MIN) A.b = Math.min(S.b, A.t + MIN)
}

function move(dx, dy, step) {
  const Q = mode === 0 ? S : A
  const lim = mode === 0 ? { l: 0, t: 0, r: W, b: H } : S
  const ddx = dx * step
  const ddy = dy * step
  if (target === 4) {
    const ww = Q.r - Q.l
    const hh = Q.b - Q.t
    const nl = clamp(Q.l + ddx, lim.l, lim.r - ww)
    const nt = clamp(Q.t + ddy, lim.t, lim.b - hh)
    Q.l = nl
    Q.r = nl + ww
    Q.t = nt
    Q.b = nt + hh
  } else if (target === 0 && ddx) {
    Q.l = clamp(Q.l + ddx, lim.l, Q.r - MIN)
  } else if (target === 2 && ddx) {
    Q.r = clamp(Q.r + ddx, Q.l + MIN, lim.r)
  } else if (target === 1 && ddy) {
    Q.t = clamp(Q.t + ddy, lim.t, Q.b - MIN)
  } else if (target === 3 && ddy) {
    Q.b = clamp(Q.b + ddy, Q.t + MIN, lim.b)
  }
  if (mode === 0) fitA()
  refresh()
}

function centerA() {
  let ww = A.r - A.l
  let hh = A.b - A.t
  if ((S.r - S.l - ww) % 2 !== 0) ww -= 1
  if ((S.b - S.t - hh) % 2 !== 0) hh -= 1
  A.l = S.l + (S.r - S.l - ww) / 2
  A.t = S.t + (S.b - S.t - hh) / 2
  A.r = A.l + ww
  A.b = A.t + hh
  refresh()
}

function resetAll() {
  S.l = 0
  S.t = 0
  S.r = W
  S.b = H
  A.l = INSET
  A.t = INSET
  A.r = W - INSET
  A.b = H - INSET
  refresh()
}

function fmt(Q) {
  return 'л' + Q.l + ' в' + Q.t + ' п' + Q.r + ' н' + Q.b + '  ' + (Q.r - Q.l) + 'x' + (Q.b - Q.t)
}
const EDGE_NAMES = ['левый край', 'верхний край', 'правый край', 'нижний край', 'вся рамка']

// ---------- отрисовка ----------
function refresh() {
  setR(w.aRect, A.l, A.t, A.r - A.l, A.b - A.t)

  // всё, что вне области экрана, закрашиваем чёрным
  setR(w.mask[0], 0, 0, W, S.t)
  setR(w.mask[1], 0, S.b, W, H - S.b)
  setR(w.mask[2], 0, S.t, S.l, S.b - S.t)
  setR(w.mask[3], S.r, S.t, W - S.r, S.b - S.t)

  // центральные линии
  const sx = centerLine(S.l, S.r, 4, 3)
  const sy = centerLine(S.t, S.b, 4, 3)
  setR(w.sV, sx[0], S.t, sx[1], S.b - S.t)
  setR(w.sH, S.l, sy[0], S.r - S.l, sy[1])
  const ax = centerLine(A.l, A.r, 2, 1)
  const ay = centerLine(A.t, A.b, 2, 1)
  setR(w.aV, ax[0], A.t, ax[1], A.b - A.t)
  setR(w.aH, A.l, ay[0], A.r - A.l, ay[1])

  // красные линии по краям области экрана
  for (let i = 0; i < 4; i++) {
    const e = edgeRect(S, i, 2)
    setR(w.sE[i], e[0], e[1], e[2], e[3])
  }

  // подсветка редактируемого края
  const Q = mode === 0 ? S : A
  for (let i = 0; i < 4; i++) {
    if (target === 4 || target === i) {
      const e = edgeRect(Q, i, target === 4 ? 2 : 5)
      setR(w.hl[i], e[0], e[1], e[2], e[3])
    } else {
      setR(w.hl[i], 0, 0, 0, 0)
    }
  }

  // уголки рабочей области
  const L = 16
  const th = 3
  setR(w.tk[0], A.l, A.t, L, th)
  setR(w.tk[1], A.l, A.t, th, L)
  setR(w.tk[2], A.r - L, A.t, L, th)
  setR(w.tk[3], A.r - th, A.t, th, L)
  setR(w.tk[4], A.l, A.b - th, L, th)
  setR(w.tk[5], A.l, A.b - L, th, L)
  setR(w.tk[6], A.r - L, A.b - th, L, th)
  setR(w.tk[7], A.r - th, A.b - L, th, L)

  // числа
  setTxt(w.t0, 'Правим: ' + (mode === 0 ? 'ЭКРАН' : 'РАБОЧУЮ') + ' - ' + EDGE_NAMES[target])
  setTxt(w.t1, 'Эк  ' + fmt(S))
  setTxt(w.t2, 'Раб ' + fmt(A))
  setTxt(w.t3, 'Поля л' + (A.l - S.l) + ' в' + (A.t - S.t) + ' п' + (S.r - A.r) + ' н' + (S.b - A.b))

  // кнопки
  setBtn(w.m0, mode === 0)
  setBtn(w.m1, mode === 1)
  for (let i = 0; i < 5; i++) setBtn(w.tg[i], target === i)
}

function draw() {
  const cx = W / 2
  const cy = H / 2

  // 1. фон и рабочая область
  R(C.GREEN, 0, 0, W, H)
  w.aRect = R(C.BLACK, A.l, A.t, A.r - A.l, A.b - A.t)

  // 2. сетка 10 px (каждая пятая линия - толще и темнее)
  for (let x = 0; x < W; x += 10) {
    const major = x % 50 === 0
    R(major ? C.GRID50 : C.GRID, x, 0, major ? 2 : 1, H)
  }
  for (let y = 0; y < H; y += 10) {
    const major = y % 50 === 0
    R(major ? C.GRID50 : C.GRID, 0, y, W, major ? 2 : 1)
  }

  // 3. подписи координат каждые 50 px (сверху, снизу, слева, справа)
  for (let x = 0; x <= W - 30; x += 50) {
    T(String(x), x + 2, 3, 30, 16, 14, C.LABEL, align.LEFT)
    T(String(x), x + 2, H - 20, 30, 16, 14, C.LABEL, align.LEFT)
  }
  for (let y = 50; y <= H - 20; y += 50) {
    T(String(y), 3, y + 2, 34, 16, 14, C.LABEL, align.LEFT)
    T(String(y), W - 36, y + 2, 34, 16, 14, C.LABEL, align.RIGHT)
  }

  // 4. чёрные маски вне области экрана
  w.mask = [dyn(C.BLACK), dyn(C.BLACK), dyn(C.BLACK), dyn(C.BLACK)]

  // 5. центральные линии и края
  w.sV = dyn(C.S_CENTER)
  w.sH = dyn(C.S_CENTER)
  w.aV = dyn(C.A_CENTER)
  w.aH = dyn(C.A_CENTER)
  w.sE = [dyn(C.S_EDGE), dyn(C.S_EDGE), dyn(C.S_EDGE), dyn(C.S_EDGE)]
  w.hl = [dyn(C.HL), dyn(C.HL), dyn(C.HL), dyn(C.HL)]
  w.tk = []
  for (let i = 0; i < 8; i++) w.tk.push(dyn(C.TICK))

  // 6. панель с числами
  RR(C.BLACK, 56, 44, W - 112, 92, 12)
  w.t0 = T('', 60, 46, W - 120, 22, 18, C.WHITE)
  w.t1 = T('', 60, 68, W - 120, 22, 18, C.WHITE)
  w.t2 = T('', 60, 90, W - 120, 22, 18, C.YELLOW)
  w.t3 = T('', 60, 112, W - 120, 22, 18, C.CYAN)

  // 7. режимы
  w.m0 = B('ЭКРАН', cx - 154, 150, 126, 56, 20, C.ON, C.ON_P, function () {
    mode = 0
    refresh()
  })
  w.m1 = B('РАБОЧАЯ', cx + 28, 150, 126, 56, 20, C.OFF, C.OFF_P, function () {
    mode = 1
    refresh()
  })

  // 8. крестовина: внешняя стрелка = 1 px, внутренняя (к центру) = 5 px
  const g = 28 // зазор от центра (там видно пересечение центральных линий)
  const s = 44
  const hw = s / 2
  B('<', cx - g - 2 * s - 2, cy - hw, s, s, 26, C.BTN, C.BTN_P, function () { move(-1, 0, 1) })
  B('<<', cx - g - s, cy - hw, s, s, 24, C.BTN5, C.BTN5_P, function () { move(-1, 0, 5) })
  B('>>', cx + g, cy - hw, s, s, 24, C.BTN5, C.BTN5_P, function () { move(1, 0, 5) })
  B('>', cx + g + s + 2, cy - hw, s, s, 26, C.BTN, C.BTN_P, function () { move(1, 0, 1) })
  B('^', cx - hw, cy - g - 2 * s - 2, s, s, 26, C.BTN, C.BTN_P, function () { move(0, -1, 1) })
  B('^^', cx - hw, cy - g - s, s, s, 24, C.BTN5, C.BTN5_P, function () { move(0, -1, 5) })
  B('vv', cx - hw, cy + g, s, s, 24, C.BTN5, C.BTN5_P, function () { move(0, 1, 5) })
  B('v', cx - hw, cy + g + s + 2, s, s, 26, C.BTN, C.BTN_P, function () { move(0, 1, 1) })

  // 9. сервисные кнопки
  B('Сброс', cx - 154, cy + 43, 126, 56, 20, C.BTN, C.BTN_P, resetAll)
  B('Центр', cx + 28, cy + 43, 126, 56, 20, C.BTN, C.BTN_P, centerA)

  // 10. выбор края
  const names = ['Лев', 'Верх', 'Прав', 'Низ', 'Все']
  w.tg = []
  for (let i = 0; i < 5; i++) {
    ;(function (k) {
      w.tg.push(B(names[k], cx - 147 + k * 60, cy + 131, 54, 40, 17, C.OFF, C.OFF_P, function () {
        target = k
        refresh()
      }))
    })(i)
  }

  // 11. диагностика
  let pxs = '?'
  try {
    pxs = util.px(100)
  } catch (e) {}
  const nm = INFO.deviceName || ''
  RR(C.BLACK, 56, cy + 178, W - 112, 22, 8)
  T(nm + ' ' + W + 'x' + H + ' px(100)=' + pxs, 60, cy + 178, W - 120, 22, 14, C.WHITE)
}

Page({
  build() {
    try {
      if (typeof ui.setStatusBarVisible === 'function') ui.setStatusBarVisible(false)
    } catch (e) {}
    try {
      display.setPageBrightTime({ brightTime: 600000 })
    } catch (e) {}
    draw()
    refresh()
  },
  onDestroy() {
    try {
      display.resetPageBrightTime()
    } catch (e) {}
  }
})
