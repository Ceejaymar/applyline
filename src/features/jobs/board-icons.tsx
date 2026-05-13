import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
  CircleHelp,
  CircleX,
  Clock,
  Globe,
  Layers,
  Linkedin,
  ListPlus,
  Mail,
  MessagesSquare,
  Rocket,
  Search,
  Send,
  Sprout,
  UserPlus,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  archive: Archive,
  "badge-check": BadgeCheck,
  bookmark: Bookmark,
  briefcase: BriefcaseBusiness,
  "circle-help": CircleHelp,
  "circle-x": CircleX,
  clock: Clock,
  globe: Globe,
  layers: Layers,
  linkedin: Linkedin,
  "list-plus": ListPlus,
  mail: Mail,
  messages: MessagesSquare,
  rocket: Rocket,
  search: Search,
  send: Send,
  sprout: Sprout,
  "user-plus": UserPlus,
};

export function getBoardIcon(icon?: string) {
  return icon ? iconMap[icon] ?? BriefcaseBusiness : BriefcaseBusiness;
}
