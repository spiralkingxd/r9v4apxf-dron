import type { LucideIcon } from "lucide-react";
import { Bomb, Bucket, Hammer, ShipWheel, User } from "lucide-react";

type RoleBadgeProps = {
  role: string;
  size?: "sm" | "md" | "lg";
};

type RoleConfig = {
  label: string;
  description: string;
  icon: LucideIcon;
  className: string;
};

const sizeClasses = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-3.5 py-2 text-sm",
} satisfies Record<NonNullable<RoleBadgeProps["size"]>, string>;

const iconSizes = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} satisfies Record<NonNullable<RoleBadgeProps["size"]>, string>;

const roleMap: Record<string, RoleConfig> = {
  timoneiro: {
    label: "Timoneiro",
    description: "Responsavel por pilotar o navio",
    icon: ShipWheel,
    className: "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  reparo: {
    label: "Reparo",
    description: "Responsavel por consertar o navio",
    icon: Hammer,
    className: "border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-300",
  },
  suporte: {
    label: "Suporte",
    description: "Apoio geral a tripulacao",
    icon: Bucket,
    className: "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  canhoneiro: {
    label: "Canhoneiro",
    description: "Responsavel pelos canhoes",
    icon: Bomb,
    className: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300",
  },
};

function normalizeRole(role: string) {
  return role
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  const normalizedRole = normalizeRole(role);
  const config = roleMap[normalizedRole] ?? {
    label: role,
    description: role,
    icon: User,
    className: "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  };
  const Icon = config.icon;

  return (
    <span
      title={config.description}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClasses[size]} ${config.className}`}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
    </span>
  );
}