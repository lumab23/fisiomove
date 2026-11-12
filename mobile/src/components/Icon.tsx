import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowLeftRight,
  Award,
  Camera,
  CameraOff,
  BriefcaseMedical,
  ChartLine,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  Clock,
  House,
  Info,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Pause,
  Pencil,
  Plus,
  Phone,
  Play,
  Settings,
  Search,
  SlidersHorizontal,
  Stethoscope,
  Trash2,
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
  search: Search,
  filter: SlidersHorizontal,
  camera: Camera,
  cameraOff: CameraOff,
  circle: Circle,
  eye: Eye,
  eyeOff: EyeOff,
  edit: Pencil,
  trash: Trash2,
  archive: Archive,
  unarchive: ArchiveRestore,
  swap: ArrowLeftRight,
  plus: Plus,
  mail: Mail,
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
