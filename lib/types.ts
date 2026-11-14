export type Card = {
  id: string;
  game: string;
  name: string;
  number: string;
  set_name: string;
  set_code: string;
  rarity: string;
  condition: string;
  grade: string;
  qty: number;
  ask: number | null;
  market: number | null;
  low: number | null;
  mid: number | null;
  price_updated: string | null;
  tcg_group_id: number | null;
  tcg_product_id: number | null;
  tcg_subtype: string | null;
  image_url: string | null;
  listed: boolean;
  sample: boolean;
};

export type Hist = { card_id: string; day: string; price: number };

export type OfferStatus =
  | "pending"
  | "countered"
  | "counter_accepted"
  | "counter_declined"
  | "accepted"
  | "declined"
  | "sold"
  | "withdrawn";

export type Offer = {
  id: string;
  user_id: string;
  card_id: string | null;
  card_name: string;
  card_label: string;
  amount: number;
  note: string;
  ask_at_offer: number | null;
  market_at_offer: number | null;
  status: OfferStatus;
  counter: number | null;
  sale_price: number | null;
  created_at: string;
  profiles?: { name: string | null; email: string | null } | null;
};

export type Sale = {
  id: string;
  card_id: string | null;
  name: string;
  price: number;
  cost: number | null;
  qty: number;
  sold_at: string;
};

export type Ev = { type: "visit" | "view"; anon_id: string; card_id: string | null; day: string };

export type Site = { name: string; tagline: string; contact: string };
