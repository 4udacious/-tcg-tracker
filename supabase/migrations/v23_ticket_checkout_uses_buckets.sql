-- The raffle-ticket checkout landed alongside the token buckets and still
-- wrote its spend straight to the ledger, which defaults to the allowance
-- bucket. That meant earned tokens were never spent and the allowance could
-- go negative - and a negative allowance EXPIRES at month end, quietly
-- handing tokens back. Route it through spend_tokens so packs and tickets
-- both draw allowance first, then earned.
--
-- The single-argument overload is dropped: the client now always passes
-- p_tickets, and leaving two candidates invites an ambiguous-call error.
--
-- Body is otherwise the raffle version unchanged; only the ledger write
-- differs. See the applied migration for the full text.

drop function if exists public.vending_checkout(jsonb);
