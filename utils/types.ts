export type UserStateInfo = {
  asset_id: number;
  borrow_balance: string;
  supply_balance: string;
};

export type ReserveDataInfo = {
  id: number;
  oracle_id: number;
  coin_type: string;
  supply_cap: string;
  borrow_cap: string;
  supply_rate: string;
  borrow_rate: string;
  supply_index: string;
  borrow_index: string;
  total_supply: string;
  total_borrow: string;
  last_update_at: string;
  ltv: string;
  treasury_factor: string;
  treasury_balance: string;
  base_rate: string;
  multiplier: string;
  jump_rate_multiplier: string;
  reserve_factor: string;
  optimal_utilization: string;
  liquidation_ratio: string;
  liquidation_bonus: string;
  liquidation_threshold: string;
};
