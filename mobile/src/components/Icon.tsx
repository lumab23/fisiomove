import {
  Activity,
  ArrowLeft,
  Award,
  BriefcaseMedical,
  ChartLine,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  House,
  Info,
  LogIn,
  LogOut,
  MessageCircle,
  Pause,
  Phone,
  Play,
  Settings,
  Stethoscope,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { colors } from '../theme/theme';

const icons = {
  home: House,
  activity: Activity,
  user: UserRound,
  chevronRight: ChevronRight,
  play: Play,
  pause: Pause,
  info: Info,
  check: CircleCheck,
  alert: CircleAlert,
  briefcase: BriefcaseMedical,
  logIn: LogIn,
  logOut: LogOut,
  history: Clock,
  chart: ChartLine,
  award: Award,
  physio: Stethoscope,
  message: MessageCircle,
  phone: Phone,
  back: ArrowLeft,
  close: X,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 24,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={2}
      fill={name === 'play' || name === 'pause' ? color : 'none'}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
