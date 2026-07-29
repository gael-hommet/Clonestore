-- Production Data & Measurement Activation Closure — hardening des grants Analytics.
-- Les deux tables sont accessibles exclusivement aux rôles serveur prévus.
-- RLS reste activée et forcée ; cette migration retire en plus les privilèges directs
-- accordés par les defaults Supabase aux rôles navigateur anon/authenticated.

revoke all privileges on table public.clonestore_analytics_events_v1
from anon, authenticated;

revoke all privileges on table public.clonestore_analytics_conversion_links_v1
from anon, authenticated;

revoke all privileges on sequence public.clonestore_analytics_events_v1_id_seq
from anon, authenticated;

revoke all privileges on sequence public.clonestore_analytics_conversion_links_v1_id_seq
from anon, authenticated;
