import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coffee,
  Download,
  Dumbbell,
  Eye,
  Flame,
  GitBranch,
  Globe,
  GraduationCap,
  Info,
  ListFilter,
  Lock,
  Pencil,
  Puzzle,
  Repeat,
  Rocket,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Table,
  Target,
  Trash,
  TreeDeciduous,
  Trophy,
  Upload,
  User,
  Volume2,
  Wrench,
  X,
} from 'lucide-react-native';

import { useTheme } from '@/ui/theme';

import type { LucideIcon } from 'lucide-react-native';

/**
 * 图标表 —— 网页版 `icon/*.svg` 的 RN 对应物（方案 §7.1 的命名映射表）。
 *
 * 用组件而不是 SVG 文件：可换色、不用打包 30 个资源、按需渲染。
 * 键名沿用网页里的 kebab-case 文件名，这样 `MODES[].icon` / `keyIcon()` 里
 * 存的字符串可以直接当键用，不用在两处维护映射。
 */
export const ICONS = {
  eye: Eye,
  pencil: Pencil,
  repeat: Repeat,
  'arrow-left-right': ArrowLeftRight,
  settings: Settings,
  'sliders-horizontal': SlidersHorizontal,
  sprout: Sprout,
  'tree-deciduous': TreeDeciduous,
  rocket: Rocket,
  trophy: Trophy,
  wrench: Wrench,
  puzzle: Puzzle,
  search: Search,
  x: X,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'rotate-ccw': RotateCcw,
  download: Download,
  upload: Upload,
  trash: Trash,
  info: Info,
  globe: Globe,
  book: BookOpen,
  table: Table,
  user: User,
  chart: ChartColumn,
  dumbbell: Dumbbell,
  filter: ListFilter,
  sound: Volume2,
  flame: Flame,
  target: Target,
  'circle-help': CircleHelp,
  /* 2026-10-04：讲解 / 我的 两个 tab 及其子页新用到的图标 */
  'graduation-cap': GraduationCap,
  'arrow-up-right': ArrowUpRight,
  coffee: Coffee,
  sparkles: Sparkles,
  lock: Lock,
  /**
   * 仓库行的图标。网页用内联 `ICO_REPO`（就是 Lucide 的 `git-branch` 图形），
   * 而 lucide-react-native 打包版**没有品牌类图标**（`Github` 不存在），
   * 所以这里按图形对齐取 `git-branch`，键名也随之叫 `git-branch`。
   */
  'git-branch': GitBranch,
} as const;

/** 表里登记的图标名 */
export type IconName = keyof typeof ICONS;

/** 供测试与「图标名拼错」检查使用 */
export const ICON_NAMES: string[] = Object.keys(ICONS);

export const hasIcon = (name: string): boolean => ICON_NAMES.indexOf(name) > -1;

export interface IconProps {
  /**
   * 图标名。**故意收 `string`** —— 名字来自数据层（`MODES[].icon`、`keyIcon()`），
   * 数据层不该反向依赖 UI 的类型；认不出的名字回退成问号图标，不会白屏。
   */
  name: string;
  size?: number;
  color?: string;
  /** 网页 SVG 统一 2px 线宽，个别地方（大图标）会调细 */
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color, strokeWidth = 2 }: IconProps) {
  const theme = useTheme();
  const ink = color ?? theme.color.ink;
  const C: LucideIcon = ICONS[name as IconName] ?? CircleHelp;
  return <C size={size} color={ink} strokeWidth={strokeWidth} />;
}
