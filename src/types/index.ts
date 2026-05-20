export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  opening_balance: string;
  current_balance: string;
  institution_name: string | null;
  credit_limit: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: string;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  is_active: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  transaction_type: string;
  account_id: string;
  category_id: string | null;
  counter_account_id: string | null;
  amount: string;
  transfer_fee: string;
  transaction_date: string;
  notes: string | null;
  status: string;
  finalized_at: string | null;
  corrects_transaction_id: string | null;
  created_at: string;
}

export interface AccountSummary {
  total_assets: string;
  total_liabilities: string;
  net_worth: string;
  total_credit_limit: string;
  total_credit_outstanding: string;
  total_credit_on_cards: string;
  available_credit: string;
  has_credit_limits: boolean;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
}
