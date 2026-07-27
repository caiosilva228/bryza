-- Keep foreign-key lookups efficient as the lost-commission ledger grows.
create index if not exists idx_ambassador_lost_commissions_customer
  on private.ambassador_lost_commissions (customer_id)
  where customer_id is not null;

create index if not exists idx_ambassador_lost_commissions_plan
  on private.ambassador_lost_commissions (commission_plan_id);
