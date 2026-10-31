export type Page<T> = {
  items: T[];
  page: number;
  totalPages: number;
  totalElements: number;
};

export type AdminRoom = {
  id: number;
  catalogName?: string;
  symbol: string;
  name: string;
  active: boolean;
  operationStatus: "OPEN" | "CLOSE";
  displayOrder: number;
  categoryId: number | null;
};

export type Category = { id: number; name: string; displayOrder: number };
export type BadgeTier = {
  name: string;
  minimumQuantity: string | number;
  icon: string;
  color: string;
  effect: string;
};
export type BadgeConfig = { symbol: string; version: number; tiers: BadgeTier[] };
export type BadgePresets = { icons: string[]; colors: string[]; effects: string[] };

export type ModerationRow = {
  id: number;
  title?: string;
  content?: string;
  nickname?: string;
  symbol?: string;
  role?: string;
  hidden?: boolean;
  suspended?: boolean;
  created_at?: string;
};
export type ModerationLog = {
  id: number;
  actor_id: number;
  target_type: string;
  target_id: number;
  before_state: string;
  after_state: string;
  reason: string;
  created_at: string;
};

export type AdminRoomPage = Page<AdminRoom>;
