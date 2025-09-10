--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (68b1d38)
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: neon_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA neon_auth;


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: get_managed_subthreads(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_managed_subthreads(user_id_param integer) RETURNS TABLE(id integer, name character varying, logo text, description text, created_at timestamp with time zone, created_by integer, members_count bigint, posts_count bigint, comments_count bigint, total_karma bigint, is_admin boolean, is_mod boolean)
    LANGUAGE plpgsql
    AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        s.id,
                        s.name,
                        s.logo,
                        s.description,
                        s.created_at,
                        s.created_by,
                        s.members_count,
                        s.posts_count,
                        s.comments_count,
                        s.total_karma,
                        CASE WHEN ur_admin.id IS NOT NULL THEN true ELSE false END as is_admin,
                        CASE WHEN ur_mod.id IS NOT NULL THEN true ELSE false END as is_mod
                    FROM subthread_stats_mv s
                    LEFT JOIN user_roles ur_admin ON s.id = ur_admin.subthread_id 
                        AND ur_admin.user_id = user_id_param 
                        AND ur_admin.role_id = (SELECT r.id FROM roles r WHERE r.slug = 'admin')
                    LEFT JOIN user_roles ur_mod ON s.id = ur_mod.subthread_id 
                        AND ur_mod.user_id = user_id_param 
                        AND ur_mod.role_id = (SELECT r.id FROM roles r WHERE r.slug = 'mod')
                    WHERE ur_admin.id IS NOT NULL OR ur_mod.id IS NOT NULL
                    ORDER BY s.created_at DESC;
                END;
                $$;


--
-- Name: get_user_subscriptions(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_subscriptions(user_id integer) RETURNS TABLE(subscription_id integer, tier_name character varying, status character varying, created_at timestamp without time zone, expires_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        s.id as subscription_id,
                        s.tier_name,
                        s.status,
                        s.created_at,
                        s.expires_at
                    FROM subscriptions s
                    WHERE s.user_id = get_user_subscriptions.user_id
                    ORDER BY s.created_at DESC;
                END;
                $$;


--
-- Name: get_user_subscriptions(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_subscriptions(user_id_param integer, limit_param integer DEFAULT 50, offset_param integer DEFAULT 0) RETURNS TABLE(id integer, name character varying, logo text, description text, created_at timestamp with time zone, created_by integer, members_count bigint, posts_count bigint, comments_count bigint, total_karma bigint, subscribed_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        s.id,
                        s.name,
                        s.logo,
                        s.description,
                        s.created_at,
                        s.created_by,
                        s.members_count,
                        s.posts_count,
                        s.comments_count,
                        s.total_karma,
                        sub.created_at as subscribed_at
                    FROM subscriptions sub
                    JOIN subthread_stats_mv s ON sub.subthread_id = s.id
                    WHERE sub.user_id = user_id_param
                    ORDER BY sub.created_at DESC
                    LIMIT limit_param OFFSET offset_param;
                END;
                $$;


--
-- Name: log_webhook_attempt(character varying, character varying, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_webhook_attempt(p_webhook_type character varying, p_payment_reference character varying, p_webhook_data jsonb, p_headers jsonb DEFAULT NULL::jsonb) RETURNS integer
    LANGUAGE plpgsql
    AS $$
            DECLARE
                log_id INTEGER;
            BEGIN
                INSERT INTO webhook_logs (webhook_type, payment_reference, webhook_data, headers)
                VALUES (p_webhook_type, p_payment_reference, p_webhook_data, p_headers)
                RETURNING id INTO log_id;
                
                RETURN log_id;
            END;
            $$;


--
-- Name: refresh_subthread_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_subthread_stats() RETURNS void
    LANGUAGE plpgsql
    AS $$
                BEGIN
                    REFRESH MATERIALIZED VIEW CONCURRENTLY subthread_stats_mv;
                END;
                $$;


--
-- Name: refresh_subthread_stats_scheduled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_subthread_stats_scheduled() RETURNS void
    LANGUAGE plpgsql
    AS $$
            BEGIN
                -- Refresh the materialized view
                REFRESH MATERIALIZED VIEW CONCURRENTLY subthread_stats_mv;
                
                -- Log the refresh
                INSERT INTO materialized_view_refresh_log (view_name, refreshed_at, status)
                VALUES ('subthread_stats_mv', NOW(), 'success');
                
                EXCEPTION WHEN OTHERS THEN
                    -- Log the error
                    INSERT INTO materialized_view_refresh_log (view_name, refreshed_at, status, error_message)
                    VALUES ('subthread_stats_mv', NOW(), 'error', SQLERRM);
                    RAISE;
            END;
            $$;


--
-- Name: search_subthreads(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_subthreads(search_term text) RETURNS TABLE(id integer, name character varying, description text, members_count bigint, posts_count bigint, similarity real)
    LANGUAGE plpgsql
    AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        s.id,
                        s.name,
                        s.description,
                        COUNT(DISTINCT sm.user_id) as members_count,
                        COUNT(DISTINCT p.id) as posts_count,
                        GREATEST(
                            similarity(s.name, search_term),
                            similarity(s.description, search_term)
                        ) as similarity
                    FROM subthreads s
                    LEFT JOIN subthread_members sm ON s.id = sm.subthread_id
                    LEFT JOIN posts p ON s.id = p.subthread_id
                    WHERE 
                        s.name ILIKE '%' || search_term || '%'
                        OR s.description ILIKE '%' || search_term || '%'
                    GROUP BY s.id, s.name, s.description
                    HAVING GREATEST(
                        similarity(s.name, search_term),
                        similarity(s.description, search_term)
                    ) > 0.1
                    ORDER BY similarity DESC;
                END;
                $$;


--
-- Name: search_subthreads(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_subthreads(search_query text, limit_param integer DEFAULT 20) RETURNS TABLE(id integer, name character varying, logo text, description text, created_at timestamp with time zone, created_by integer, members_count bigint, posts_count bigint, comments_count bigint, total_karma bigint, similarity_score real)
    LANGUAGE plpgsql
    AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        s.id,
                        s.name,
                        s.logo,
                        s.description,
                        s.created_at,
                        s.created_by,
                        s.members_count,
                        s.posts_count,
                        s.comments_count,
                        s.total_karma,
                        GREATEST(
                            similarity(s.name::TEXT, search_query),
                            similarity(COALESCE(s.description, ''), search_query)
                        ) as similarity_score
                    FROM subthread_stats_mv s
                    WHERE 
                        s.name ILIKE '%' || search_query || '%' OR
                        COALESCE(s.description, '') ILIKE '%' || search_query || '%'
                    ORDER BY similarity_score DESC, s.members_count DESC
                    LIMIT limit_param;
                END;
                $$;


--
-- Name: search_users(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_users(search_term text) RETURNS TABLE(id integer, username character varying, email character varying, similarity real)
    LANGUAGE plpgsql
    AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        u.id,
                        u.username,
                        u.email,
                        similarity(u.username, search_term) as similarity
                    FROM users u
                    WHERE u.username ILIKE '%' || search_term || '%'
                    HAVING similarity(u.username, search_term) > 0.1
                    ORDER BY similarity DESC;
                END;
                $$;


--
-- Name: search_users(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_users(search_query text, limit_param integer DEFAULT 20) RETURNS TABLE(id integer, username text, avatar text, bio text, registration_date timestamp with time zone, user_karma bigint)
    LANGUAGE plpgsql
    AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        u.id,
                        u.username,
                        u.avatar,
                        u.bio,
                        u.registration_date,
                        COALESCE(ui.user_karma, 0) as user_karma
                    FROM users u
                    LEFT JOIN user_info ui ON u.id = ui.user_id
                    WHERE 
                        u.username ILIKE '%' || search_query || '%' AND
                        u.is_email_verified = true AND
                        u.deleted = false AND
                        NOT u.username LIKE 'del_%'
                    ORDER BY 
                        CASE WHEN u.username ILIKE search_query || '%' THEN 1 ELSE 2 END,
                        COALESCE(ui.user_karma, 0) DESC
                    LIMIT limit_param;
                END;
                $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users_sync; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.users_sync (
    raw_json jsonb NOT NULL,
    id text GENERATED ALWAYS AS ((raw_json ->> 'id'::text)) STORED NOT NULL,
    name text GENERATED ALWAYS AS ((raw_json ->> 'display_name'::text)) STORED,
    email text GENERATED ALWAYS AS ((raw_json ->> 'primary_email'::text)) STORED,
    created_at timestamp with time zone GENERATED ALWAYS AS (to_timestamp((trunc((((raw_json ->> 'signed_up_at_millis'::text))::bigint)::double precision) / (1000)::double precision))) STORED,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: avatar_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avatar_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: avatar_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.avatar_categories ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.avatar_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: avatar_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avatar_items (
    id integer NOT NULL,
    category_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    image_url text NOT NULL,
    price_coins integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);


--
-- Name: avatar_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.avatar_items ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.avatar_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: coin_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_packages (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    coin_amount integer NOT NULL,
    price_vnd integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: coin_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.coin_packages ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.coin_packages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: coin_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_payments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    package_id integer NOT NULL,
    amount_vnd integer NOT NULL,
    coin_amount integer NOT NULL,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    momo_trans_id character varying(100),
    momo_order_id character varying(100),
    notes text,
    callback_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp with time zone,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    currency character varying(3) DEFAULT 'VND'::character varying,
    momo_request_id character varying(100),
    payment_method character varying(50) DEFAULT 'momo'::character varying,
    payment_url text,
    expires_at timestamp with time zone,
    is_first_purchase boolean DEFAULT false
);


--
-- Name: coin_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.coin_payments ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.coin_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: coin_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    transaction_type character varying(50) NOT NULL,
    amount integer NOT NULL,
    balance_after integer NOT NULL,
    reference_id integer,
    reference_type character varying(50),
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT coin_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['purchase'::character varying, 'tip_sent'::character varying, 'tip_received'::character varying, 'avatar_purchase'::character varying, 'post_boost'::character varying, 'tier_purchase'::character varying, 'bonus'::character varying])::text[])))
);


--
-- Name: coin_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.coin_transactions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.coin_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    post_id integer NOT NULL,
    parent_id integer,
    has_parent boolean,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_edited boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    media text
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    subthread_id integer NOT NULL,
    title text NOT NULL,
    media text,
    content text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_edited boolean DEFAULT false
);


--
-- Name: reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    post_id integer,
    comment_id integer,
    is_upvote boolean NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    email text NOT NULL,
    avatar text,
    bio text,
    registration_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    language_preference character varying(3) DEFAULT 'en'::character varying,
    is_email_verified boolean DEFAULT false NOT NULL,
    email_verification_token text,
    email_verification_expires_at timestamp with time zone,
    current_tier_id integer,
    theme_preference character varying(20) DEFAULT 'light'::character varying,
    theme character varying(10) DEFAULT 'light'::character varying NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    account_deletion_token text,
    account_deletion_expires_at timestamp with time zone,
    account_deletion_requested_at timestamp with time zone
);


--
-- Name: comment_info; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.comment_info AS
 SELECT c.id AS comment_id,
    u.username AS user_name,
    u.avatar AS user_avatar,
    ckarma.comment_karma,
    c.has_parent,
    c.parent_id,
    c.is_edited,
    c.content,
    c.created_at,
    p.id AS post_id
   FROM (((public.posts p
     FULL JOIN public.comments c ON ((c.post_id = p.id)))
     FULL JOIN ( SELECT c_1.id AS comment_id,
            COALESCE(sum(
                CASE
                    WHEN (r.is_upvote = true) THEN 1
                    WHEN (r.is_upvote = false) THEN '-1'::integer
                    ELSE 0
                END), (0)::bigint) AS comment_karma
           FROM (public.comments c_1
             FULL JOIN public.reactions r ON ((r.comment_id = c_1.id)))
          GROUP BY c_1.id
         HAVING (c_1.id IS NOT NULL)) ckarma ON ((ckarma.comment_id = c.id)))
     FULL JOIN public.users u ON ((u.id = c.user_id)));


--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: custom_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_themes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    theme_name character varying(100) NOT NULL,
    theme_data jsonb NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: custom_themes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.custom_themes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: custom_themes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.custom_themes_id_seq OWNED BY public.custom_themes.id;


--
-- Name: demo_mode_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demo_mode_settings (
    id integer NOT NULL,
    user_id integer,
    is_enabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: demo_mode_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.demo_mode_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: demo_mode_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.demo_mode_settings_id_seq OWNED BY public.demo_mode_settings.id;


--
-- Name: manual_payment_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_payment_verifications (
    id integer NOT NULL,
    payment_id integer,
    verified_by integer,
    verification_method character varying(50) DEFAULT 'manual'::character varying,
    verification_notes text,
    verified_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'pending'::character varying
);


--
-- Name: manual_payment_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.manual_payment_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: manual_payment_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.manual_payment_verifications_id_seq OWNED BY public.manual_payment_verifications.id;


--
-- Name: materialized_view_refresh_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materialized_view_refresh_log (
    id integer NOT NULL,
    view_name character varying(100) NOT NULL,
    refreshed_at timestamp with time zone NOT NULL,
    status character varying(20) NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: materialized_view_refresh_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.materialized_view_refresh_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: materialized_view_refresh_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.materialized_view_refresh_log_id_seq OWNED BY public.materialized_view_refresh_log.id;


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id integer NOT NULL,
    post_id integer,
    comment_id integer,
    media_url text NOT NULL,
    media_type text NOT NULL,
    media_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'gif'::text])))
);


--
-- Name: media_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    sender_id integer NOT NULL,
    receiver_id integer NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    seen boolean DEFAULT false NOT NULL,
    seen_at timestamp with time zone,
    media text,
    edited_at timestamp with time zone,
    content_encrypted bytea,
    encryption_version integer DEFAULT 1,
    encryption_key_id character varying(255),
    iv bytea
);


--
-- Name: messages_backup_1754654275; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages_backup_1754654275 (
    id integer,
    sender_id integer,
    receiver_id integer,
    content text,
    created_at timestamp with time zone,
    seen boolean,
    seen_at timestamp with time zone,
    media text,
    edited_at timestamp with time zone
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tier_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'VND'::character varying,
    momo_order_id character varying(100),
    momo_request_id character varying(100),
    momo_trans_id character varying(100),
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(50) DEFAULT 'momo'::character varying,
    payment_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp with time zone,
    expires_at timestamp with time zone,
    callback_data jsonb,
    notes text
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.payments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tiers (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    slug character varying(50) NOT NULL,
    price_monthly numeric(10,2) NOT NULL,
    max_subthreads integer,
    can_custom_theme boolean DEFAULT false,
    description text,
    features jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false
);


--
-- Name: pending_payments_for_verification; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pending_payments_for_verification AS
 SELECT p.id AS payment_id,
    p.user_id,
    p.tier_id,
    p.amount,
    p.notes,
    p.created_at,
    p.expires_at,
    u.username,
    ut.name AS tier_name,
        CASE
            WHEN (p.expires_at < now()) THEN 'expired'::text
            WHEN (p.created_at < (now() - '01:00:00'::interval)) THEN 'ready_for_verification'::text
            ELSE 'too_recent'::text
        END AS verification_status
   FROM ((public.payments p
     JOIN public.users u ON ((p.user_id = u.id)))
     JOIN public.user_tiers ut ON ((p.tier_id = ut.id)))
  WHERE (((p.payment_status)::text = 'pending'::text) AND (p.callback_data IS NULL))
  ORDER BY p.created_at DESC;


--
-- Name: post_boosts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_boosts (
    id integer NOT NULL,
    post_id integer NOT NULL,
    user_id integer NOT NULL,
    boost_start timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    boost_end timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: post_boosts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.post_boosts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.post_boosts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: subthreads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subthreads (
    id integer NOT NULL,
    name character varying(20) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    logo text,
    created_by integer
);


--
-- Name: post_info; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.post_info AS
 SELECT t.id AS thread_id,
    t.name AS thread_name,
    t.logo AS thread_logo,
    p.id AS post_id,
    k.karma AS post_karma,
    p.title,
    p.media,
    p.is_edited,
    p.content,
    p.created_at,
    u.id AS user_id,
    u.username AS user_name,
    u.avatar AS user_avatar,
    c.comments_count
   FROM ((((public.posts p
     JOIN ( SELECT p_1.id AS post_id,
            COALESCE(sum(
                CASE
                    WHEN (r.is_upvote = true) THEN 1
                    WHEN (r.is_upvote = false) THEN '-1'::integer
                    ELSE 0
                END), (0)::bigint) AS karma
           FROM (public.posts p_1
             FULL JOIN public.reactions r ON ((r.post_id = p_1.id)))
          GROUP BY p_1.id) k ON ((k.post_id = p.id)))
     JOIN ( SELECT p_1.id AS post_id,
            count(c_1.id) AS comments_count
           FROM (public.posts p_1
             FULL JOIN public.comments c_1 ON ((c_1.post_id = p_1.id)))
          GROUP BY p_1.id) c ON ((c.post_id = p.id)))
     JOIN public.subthreads t ON ((t.id = p.subthread_id)))
     JOIN public.users u ON ((u.id = p.user_id)));


--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;


--
-- Name: reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reactions_id_seq OWNED BY public.reactions.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: saved; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved (
    id integer NOT NULL,
    user_id integer NOT NULL,
    post_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: saved_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.saved_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: saved_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.saved_id_seq OWNED BY public.saved.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    subthread_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: subthread_bans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subthread_bans (
    id integer NOT NULL,
    user_id integer NOT NULL,
    subthread_id integer NOT NULL,
    banned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    banned_by integer NOT NULL,
    reason text DEFAULT 'Unspecific Ban Reason'::text
);


--
-- Name: subthread_bans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.subthread_bans ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.subthread_bans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: subthread_info; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.subthread_info AS
 SELECT subthreads.id,
    subthreads.name,
    subthreads.logo,
    mcount.members_count,
    pcount.posts_count,
    ccount.comments_count
   FROM (((public.subthreads
     FULL JOIN ( SELECT subthreads_1.id AS subthread_id,
            count(*) AS members_count
           FROM (public.subthreads subthreads_1
             JOIN public.subscriptions ON ((subscriptions.subthread_id = subthreads_1.id)))
          GROUP BY subthreads_1.id) mcount ON ((mcount.subthread_id = subthreads.id)))
     FULL JOIN ( SELECT subthreads_1.id AS subthread_id,
            count(*) AS posts_count
           FROM (public.subthreads subthreads_1
             JOIN public.posts ON ((posts.subthread_id = subthreads_1.id)))
          GROUP BY subthreads_1.id) pcount ON ((pcount.subthread_id = subthreads.id)))
     FULL JOIN ( SELECT subthreads_1.id AS subthread_id,
            count(*) AS comments_count
           FROM ((public.subthreads subthreads_1
             JOIN public.posts ON ((posts.subthread_id = subthreads_1.id)))
             JOIN public.comments ON ((comments.post_id = posts.id)))
          GROUP BY subthreads_1.id) ccount ON ((ccount.subthread_id = subthreads.id)));


--
-- Name: subthread_stats_mv; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.subthread_stats_mv AS
 SELECT s.id,
    s.name,
    s.logo,
    s.description,
    s.created_at,
    s.created_by,
    count(DISTINCT sub.user_id) AS members_count,
    count(DISTINCT p.id) AS posts_count,
    count(DISTINCT c.id) AS comments_count,
    COALESCE(sum(
        CASE
            WHEN (r.is_upvote = true) THEN 1
            WHEN (r.is_upvote = false) THEN '-1'::integer
            ELSE 0
        END), (0)::bigint) AS total_karma
   FROM ((((public.subthreads s
     LEFT JOIN public.subscriptions sub ON ((s.id = sub.subthread_id)))
     LEFT JOIN public.posts p ON ((s.id = p.subthread_id)))
     LEFT JOIN public.comments c ON ((p.id = c.post_id)))
     LEFT JOIN public.reactions r ON (((r.post_id = p.id) OR (r.comment_id = c.id))))
  GROUP BY s.id, s.name, s.logo, s.description, s.created_at, s.created_by
  WITH NO DATA;


--
-- Name: subthreads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subthreads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subthreads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subthreads_id_seq OWNED BY public.subthreads.id;


--
-- Name: tier_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tier_purchases (
    id integer NOT NULL,
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    purchased_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone NOT NULL,
    payment_reference text,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    extra_data jsonb
);


--
-- Name: tier_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tier_purchases ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tier_purchases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: translation_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translation_cache (
    id integer NOT NULL,
    content_hash character varying(64),
    source_language character varying(10),
    target_language character varying(10),
    original_text text,
    translated_text text,
    translation_method character varying(50),
    confidence_score double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_used timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    usage_count integer DEFAULT 1
);


--
-- Name: translation_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.translation_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: translation_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.translation_cache_id_seq OWNED BY public.translation_cache.id;


--
-- Name: translation_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translation_limits (
    id integer NOT NULL,
    role_slug character varying(20) NOT NULL,
    monthly_limit integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: translation_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.translation_limits ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.translation_limits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: translation_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translation_usage (
    id integer NOT NULL,
    user_id integer,
    post_id integer,
    comment_id integer,
    source_language character varying(10) NOT NULL,
    target_language character varying(10) NOT NULL,
    original_text text NOT NULL,
    translated_text text NOT NULL,
    translation_method character varying(50) NOT NULL,
    confidence_score double precision,
    translated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT translation_usage_content_check CHECK ((((post_id IS NOT NULL) AND (comment_id IS NULL)) OR ((post_id IS NULL) AND (comment_id IS NOT NULL))))
);


--
-- Name: translation_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.translation_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: translation_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.translation_usage_id_seq OWNED BY public.translation_usage.id;


--
-- Name: user_avatars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_avatars (
    id integer NOT NULL,
    user_id integer NOT NULL,
    avatar_id integer NOT NULL,
    is_equipped boolean DEFAULT false,
    purchased_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_avatars_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_avatars ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.user_avatars_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_blocks (
    id integer NOT NULL,
    blocker_id integer NOT NULL,
    blocked_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_blocks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_blocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_blocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_blocks_id_seq OWNED BY public.user_blocks.id;


--
-- Name: user_custom_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_custom_themes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    theme_name character varying(100) NOT NULL,
    theme_data jsonb NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_custom_themes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_custom_themes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_custom_themes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_info; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_info AS
 SELECT u.id AS user_id,
    (c.karma + p.karma) AS user_karma,
    c.comments_count,
    c.karma AS comments_karma,
    p.posts_count,
    p.karma AS posts_karma
   FROM ((public.users u
     JOIN ( SELECT u_1.id AS user_id,
            count(c_1.id) AS comments_count,
            COALESCE(sum(
                CASE
                    WHEN ((r.is_upvote = true) AND (r.comment_id IS NOT NULL)) THEN 1
                    WHEN ((r.is_upvote = false) AND (r.comment_id IS NOT NULL)) THEN '-1'::integer
                    ELSE 0
                END), (0)::bigint) AS karma
           FROM ((public.users u_1
             FULL JOIN public.comments c_1 ON ((c_1.user_id = u_1.id)))
             FULL JOIN public.reactions r ON ((r.comment_id = c_1.id)))
          GROUP BY u_1.id) c ON ((c.user_id = u.id)))
     JOIN ( SELECT u_1.id AS user_id,
            count(p_1.id) AS posts_count,
            COALESCE(sum(
                CASE
                    WHEN ((r.is_upvote = true) AND (r.post_id IS NOT NULL)) THEN 1
                    WHEN ((r.is_upvote = false) AND (r.post_id IS NOT NULL)) THEN '-1'::integer
                    ELSE 0
                END), (0)::bigint) AS karma
           FROM ((public.users u_1
             FULL JOIN public.posts p_1 ON ((p_1.user_id = u_1.id)))
             FULL JOIN public.reactions r ON ((r.post_id = p_1.id)))
          GROUP BY u_1.id) p ON ((p.user_id = u.id)));


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    subthread_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone
);


--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- Name: user_stats_mv; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.user_stats_mv AS
 SELECT u.id AS user_id,
    u.username,
    u.avatar,
    u.bio,
    u.registration_date,
    u.language_preference,
    u.theme,
    COALESCE(posts.posts_count, (0)::bigint) AS posts_count,
    COALESCE(comments.comments_count, (0)::bigint) AS comments_count,
    COALESCE(post_karma.karma, (0)::bigint) AS post_karma,
    COALESCE(comment_karma.karma, (0)::bigint) AS comment_karma,
    (COALESCE(post_karma.karma, (0)::bigint) + COALESCE(comment_karma.karma, (0)::bigint)) AS total_karma
   FROM ((((public.users u
     LEFT JOIN ( SELECT posts_1.user_id,
            count(*) AS posts_count
           FROM public.posts posts_1
          GROUP BY posts_1.user_id) posts ON ((u.id = posts.user_id)))
     LEFT JOIN ( SELECT comments_1.user_id,
            count(*) AS comments_count
           FROM public.comments comments_1
          GROUP BY comments_1.user_id) comments ON ((u.id = comments.user_id)))
     LEFT JOIN ( SELECT p.user_id,
            sum(
                CASE
                    WHEN r.is_upvote THEN 1
                    ELSE '-1'::integer
                END) AS karma
           FROM (public.posts p
             LEFT JOIN public.reactions r ON ((p.id = r.post_id)))
          GROUP BY p.user_id) post_karma ON ((u.id = post_karma.user_id)))
     LEFT JOIN ( SELECT c.user_id,
            sum(
                CASE
                    WHEN r.is_upvote THEN 1
                    ELSE '-1'::integer
                END) AS karma
           FROM (public.comments c
             LEFT JOIN public.reactions r ON ((c.id = r.comment_id)))
          GROUP BY c.user_id) comment_karma ON ((u.id = comment_karma.user_id)))
  WHERE (u.deleted = false)
  WITH NO DATA;


--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tier_id integer NOT NULL,
    payment_id integer,
    starts_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    auto_renew boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    cancelled_at timestamp with time zone
);


--
-- Name: user_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_subscriptions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_tiers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_tiers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_translation_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_translation_stats (
    id integer NOT NULL,
    user_id integer NOT NULL,
    translations_used integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    year_month character varying(7) NOT NULL
);


--
-- Name: user_translation_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_translation_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_translation_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_translation_stats_id_seq OWNED BY public.user_translation_stats.id;


--
-- Name: user_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_wallets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    coin_balance integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_wallets ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.user_wallets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_logs (
    id integer NOT NULL,
    webhook_type character varying(50) NOT NULL,
    payment_reference character varying(100),
    webhook_data jsonb,
    headers jsonb,
    received_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    status character varying(20) DEFAULT 'received'::character varying,
    error_message text,
    processing_time_ms integer
);


--
-- Name: webhook_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.webhook_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webhook_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.webhook_logs_id_seq OWNED BY public.webhook_logs.id;


--
-- Name: webhook_monitoring; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.webhook_monitoring AS
 SELECT wl.id,
    wl.webhook_type,
    wl.payment_reference,
    wl.received_at,
    wl.processed_at,
    wl.status,
    wl.error_message,
    wl.processing_time_ms,
    p.payment_status,
    p.user_id,
    p.tier_id
   FROM (public.webhook_logs wl
     LEFT JOIN public.payments p ON ((p.notes ~~ (('%'::text || (wl.payment_reference)::text) || '%'::text))))
  ORDER BY wl.received_at DESC;


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: custom_themes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_themes ALTER COLUMN id SET DEFAULT nextval('public.custom_themes_id_seq'::regclass);


--
-- Name: demo_mode_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_mode_settings ALTER COLUMN id SET DEFAULT nextval('public.demo_mode_settings_id_seq'::regclass);


--
-- Name: manual_payment_verifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_payment_verifications ALTER COLUMN id SET DEFAULT nextval('public.manual_payment_verifications_id_seq'::regclass);


--
-- Name: materialized_view_refresh_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materialized_view_refresh_log ALTER COLUMN id SET DEFAULT nextval('public.materialized_view_refresh_log_id_seq'::regclass);


--
-- Name: media id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media ALTER COLUMN id SET DEFAULT nextval('public.media_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: posts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts ALTER COLUMN id SET DEFAULT nextval('public.posts_id_seq'::regclass);


--
-- Name: reactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions ALTER COLUMN id SET DEFAULT nextval('public.reactions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: saved id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved ALTER COLUMN id SET DEFAULT nextval('public.saved_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: subthreads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subthreads ALTER COLUMN id SET DEFAULT nextval('public.subthreads_id_seq'::regclass);


--
-- Name: translation_cache id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_cache ALTER COLUMN id SET DEFAULT nextval('public.translation_cache_id_seq'::regclass);


--
-- Name: translation_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_usage ALTER COLUMN id SET DEFAULT nextval('public.translation_usage_id_seq'::regclass);


--
-- Name: user_blocks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks ALTER COLUMN id SET DEFAULT nextval('public.user_blocks_id_seq'::regclass);


--
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- Name: user_translation_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_translation_stats ALTER COLUMN id SET DEFAULT nextval('public.user_translation_stats_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: webhook_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs ALTER COLUMN id SET DEFAULT nextval('public.webhook_logs_id_seq'::regclass);


--
-- Name: users_sync users_sync_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.users_sync
    ADD CONSTRAINT users_sync_pkey PRIMARY KEY (id);


--
-- Name: avatar_categories avatar_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_categories
    ADD CONSTRAINT avatar_categories_pkey PRIMARY KEY (id);


--
-- Name: avatar_items avatar_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_items
    ADD CONSTRAINT avatar_items_pkey PRIMARY KEY (id);


--
-- Name: coin_packages coin_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_packages
    ADD CONSTRAINT coin_packages_pkey PRIMARY KEY (id);


--
-- Name: coin_payments coin_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_payments
    ADD CONSTRAINT coin_payments_pkey PRIMARY KEY (id);


--
-- Name: coin_transactions coin_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: custom_themes custom_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_themes
    ADD CONSTRAINT custom_themes_pkey PRIMARY KEY (id);


--
-- Name: demo_mode_settings demo_mode_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_mode_settings
    ADD CONSTRAINT demo_mode_settings_pkey PRIMARY KEY (id);


--
-- Name: demo_mode_settings demo_mode_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_mode_settings
    ADD CONSTRAINT demo_mode_settings_user_id_key UNIQUE (user_id);


--
-- Name: manual_payment_verifications manual_payment_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_payment_verifications
    ADD CONSTRAINT manual_payment_verifications_pkey PRIMARY KEY (id);


--
-- Name: materialized_view_refresh_log materialized_view_refresh_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materialized_view_refresh_log
    ADD CONSTRAINT materialized_view_refresh_log_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: payments payments_momo_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_momo_order_id_key UNIQUE (momo_order_id);


--
-- Name: payments payments_momo_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_momo_request_id_key UNIQUE (momo_request_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: post_boosts post_boosts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_boosts
    ADD CONSTRAINT post_boosts_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_user_id_comment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_comment_id_key UNIQUE (user_id, comment_id);


--
-- Name: reactions reactions_user_id_post_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_post_id_key UNIQUE (user_id, post_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_slug_key UNIQUE (slug);


--
-- Name: saved saved_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved
    ADD CONSTRAINT saved_pkey PRIMARY KEY (id);


--
-- Name: saved saved_user_id_post_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved
    ADD CONSTRAINT saved_user_id_post_id_key UNIQUE (user_id, post_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_user_id_subthread_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_subthread_id_key UNIQUE (user_id, subthread_id);


--
-- Name: subthread_bans subthread_bans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subthread_bans
    ADD CONSTRAINT subthread_bans_pkey PRIMARY KEY (id);


--
-- Name: subthread_bans subthread_bans_user_subthread_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subthread_bans
    ADD CONSTRAINT subthread_bans_user_subthread_unique UNIQUE (user_id, subthread_id);


--
-- Name: subthreads subthreads_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subthreads
    ADD CONSTRAINT subthreads_name_key UNIQUE (name);


--
-- Name: subthreads subthreads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subthreads
    ADD CONSTRAINT subthreads_pkey PRIMARY KEY (id);


--
-- Name: tier_purchases tier_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_purchases
    ADD CONSTRAINT tier_purchases_pkey PRIMARY KEY (id);


--
-- Name: translation_cache translation_cache_content_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_cache
    ADD CONSTRAINT translation_cache_content_hash_key UNIQUE (content_hash);


--
-- Name: translation_cache translation_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_cache
    ADD CONSTRAINT translation_cache_pkey PRIMARY KEY (id);


--
-- Name: translation_limits translation_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_limits
    ADD CONSTRAINT translation_limits_pkey PRIMARY KEY (id);


--
-- Name: translation_usage translation_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_usage
    ADD CONSTRAINT translation_usage_pkey PRIMARY KEY (id);


--
-- Name: custom_themes unique_theme_name_per_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_themes
    ADD CONSTRAINT unique_theme_name_per_user UNIQUE (user_id, theme_name);


--
-- Name: user_avatars user_avatars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_avatars
    ADD CONSTRAINT user_avatars_pkey PRIMARY KEY (id);


--
-- Name: user_avatars user_avatars_user_id_avatar_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_avatars
    ADD CONSTRAINT user_avatars_user_id_avatar_id_key UNIQUE (user_id, avatar_id);


--
-- Name: user_blocks user_blocks_blocker_id_blocked_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);


--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (id);


--
-- Name: user_custom_themes user_custom_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_themes
    ADD CONSTRAINT user_custom_themes_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_subthread_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_subthread_id_key UNIQUE (user_id, role_id, subthread_id);


--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_subscriptions user_subscriptions_user_tier_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_tier_unique UNIQUE (user_id, tier_id);


--
-- Name: user_tiers user_tiers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tiers
    ADD CONSTRAINT user_tiers_name_key UNIQUE (name);


--
-- Name: user_tiers user_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tiers
    ADD CONSTRAINT user_tiers_pkey PRIMARY KEY (id);


--
-- Name: user_tiers user_tiers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tiers
    ADD CONSTRAINT user_tiers_slug_key UNIQUE (slug);


--
-- Name: user_translation_stats user_translation_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_translation_stats
    ADD CONSTRAINT user_translation_stats_pkey PRIMARY KEY (id);


--
-- Name: user_wallets user_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_wallets
    ADD CONSTRAINT user_wallets_pkey PRIMARY KEY (id);


--
-- Name: user_wallets user_wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_wallets
    ADD CONSTRAINT user_wallets_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: users_sync_deleted_at_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX users_sync_deleted_at_idx ON neon_auth.users_sync USING btree (deleted_at);


--
-- Name: idx_avatar_items_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_avatar_items_active ON public.avatar_items USING btree (is_active);


--
-- Name: idx_avatar_items_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_avatar_items_category_id ON public.avatar_items USING btree (category_id);


--
-- Name: idx_avatar_items_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_avatar_items_price ON public.avatar_items USING btree (price_coins);


--
-- Name: idx_coin_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_payments_status ON public.coin_payments USING btree (payment_status);


--
-- Name: idx_coin_payments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_payments_user_id ON public.coin_payments USING btree (user_id);


--
-- Name: idx_coin_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_created_at ON public.coin_transactions USING btree (created_at);


--
-- Name: idx_coin_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_type ON public.coin_transactions USING btree (transaction_type);


--
-- Name: idx_coin_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_user_id ON public.coin_transactions USING btree (user_id);


--
-- Name: idx_comments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_created_at ON public.comments USING btree (created_at DESC);


--
-- Name: idx_comments_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_parent_id ON public.comments USING btree (parent_id);


--
-- Name: idx_comments_post_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_post_created ON public.comments USING btree (post_id, created_at);


--
-- Name: idx_comments_post_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_post_created_at ON public.comments USING btree (post_id, created_at DESC);


--
-- Name: idx_comments_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_post_id ON public.comments USING btree (post_id);


--
-- Name: idx_comments_user_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_user_created_at ON public.comments USING btree (user_id, created_at DESC);


--
-- Name: idx_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_user_id ON public.comments USING btree (user_id);


--
-- Name: idx_custom_themes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_themes_active ON public.custom_themes USING btree (is_active);


--
-- Name: idx_custom_themes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_themes_created_at ON public.custom_themes USING btree (created_at);


--
-- Name: idx_custom_themes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_themes_user_id ON public.custom_themes USING btree (user_id);


--
-- Name: idx_demo_mode_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demo_mode_settings_user_id ON public.demo_mode_settings USING btree (user_id);


--
-- Name: idx_media_comment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_comment_id ON public.media USING btree (comment_id);


--
-- Name: idx_media_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_order ON public.media USING btree (media_order);


--
-- Name: idx_media_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_post_id ON public.media USING btree (post_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_receiver_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_receiver_id ON public.messages USING btree (receiver_id);


--
-- Name: idx_messages_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_seen ON public.messages USING btree (seen);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- Name: idx_messages_sender_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender_receiver ON public.messages USING btree (sender_id, receiver_id);


--
-- Name: idx_mv_refresh_log_view_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mv_refresh_log_view_time ON public.materialized_view_refresh_log USING btree (view_name, refreshed_at);


--
-- Name: idx_payments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at DESC);


--
-- Name: idx_payments_momo_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_momo_order_id ON public.payments USING btree (momo_order_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (payment_status);


--
-- Name: idx_payments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_user_id ON public.payments USING btree (user_id);


--
-- Name: idx_post_boosts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_boosts_active ON public.post_boosts USING btree (is_active);


--
-- Name: idx_post_boosts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_boosts_created_at ON public.post_boosts USING btree (created_at DESC);


--
-- Name: idx_post_boosts_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_boosts_end ON public.post_boosts USING btree (boost_end);


--
-- Name: idx_post_boosts_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_boosts_post_id ON public.post_boosts USING btree (post_id);


--
-- Name: idx_posts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_created_at ON public.posts USING btree (created_at DESC);


--
-- Name: idx_posts_is_edited; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_is_edited ON public.posts USING btree (is_edited);


--
-- Name: idx_posts_subthread_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_subthread_created ON public.posts USING btree (subthread_id, created_at DESC);


--
-- Name: idx_posts_subthread_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_subthread_created_at ON public.posts USING btree (subthread_id, created_at DESC);


--
-- Name: idx_posts_subthread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_subthread_id ON public.posts USING btree (subthread_id);


--
-- Name: idx_posts_subthread_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_subthread_user ON public.posts USING btree (subthread_id, user_id);


--
-- Name: idx_posts_user_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_user_created_at ON public.posts USING btree (user_id, created_at DESC);


--
-- Name: idx_posts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_user_id ON public.posts USING btree (user_id);


--
-- Name: idx_posts_user_subthread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_user_subthread ON public.posts USING btree (user_id, subthread_id);


--
-- Name: idx_reactions_comment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_comment_id ON public.reactions USING btree (comment_id);


--
-- Name: idx_reactions_comment_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_comment_user ON public.reactions USING btree (comment_id, user_id);


--
-- Name: idx_reactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_created_at ON public.reactions USING btree (created_at DESC);


--
-- Name: idx_reactions_is_upvote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_is_upvote ON public.reactions USING btree (is_upvote);


--
-- Name: idx_reactions_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_post_id ON public.reactions USING btree (post_id);


--
-- Name: idx_reactions_post_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_post_user ON public.reactions USING btree (post_id, user_id);


--
-- Name: idx_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reactions_user_id ON public.reactions USING btree (user_id);


--
-- Name: idx_subscriptions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_created_at ON public.subscriptions USING btree (created_at);


--
-- Name: idx_subscriptions_subthread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_subthread_id ON public.subscriptions USING btree (subthread_id);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- Name: idx_subscriptions_user_subthread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_subthread ON public.subscriptions USING btree (user_id, subthread_id);


--
-- Name: idx_subthread_bans_subthread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subthread_bans_subthread_id ON public.subthread_bans USING btree (subthread_id);


--
-- Name: idx_subthread_bans_user_subthread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subthread_bans_user_subthread ON public.subthread_bans USING btree (user_id, subthread_id);


--
-- Name: idx_subthread_stats_mv_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_subthread_stats_mv_id_unique ON public.subthread_stats_mv USING btree (id);


--
-- Name: idx_subthreads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subthreads_created_at ON public.subthreads USING btree (created_at);


--
-- Name: idx_subthreads_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subthreads_created_by ON public.subthreads USING btree (created_by);


--
-- Name: idx_subthreads_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subthreads_name ON public.subthreads USING btree (name);


--
-- Name: idx_translation_cache_content_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translation_cache_content_hash ON public.translation_cache USING btree (content_hash);


--
-- Name: idx_translation_cache_languages; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translation_cache_languages ON public.translation_cache USING btree (source_language, target_language);


--
-- Name: idx_translation_cache_last_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translation_cache_last_used ON public.translation_cache USING btree (last_used DESC);


--
-- Name: idx_translation_usage_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translation_usage_created_at ON public.translation_usage USING btree (translated_at DESC);


--
-- Name: idx_translation_usage_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translation_usage_user_id ON public.translation_usage USING btree (user_id);


--
-- Name: idx_user_avatars_avatar_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_avatars_avatar_id ON public.user_avatars USING btree (avatar_id);


--
-- Name: idx_user_avatars_equipped; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_avatars_equipped ON public.user_avatars USING btree (is_equipped);


--
-- Name: idx_user_avatars_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_avatars_user_id ON public.user_avatars USING btree (user_id);


--
-- Name: idx_user_custom_themes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_custom_themes_user_id ON public.user_custom_themes USING btree (user_id);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_subthread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_subthread_id ON public.user_roles USING btree (subthread_id);


--
-- Name: idx_user_roles_subthread_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_subthread_role ON public.user_roles USING btree (subthread_id, role_id);


--
-- Name: idx_user_roles_user_subthread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_subthread ON public.user_roles USING btree (user_id, subthread_id);


--
-- Name: idx_user_stats_mv_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_stats_mv_id ON public.user_stats_mv USING btree (user_id);


--
-- Name: idx_user_stats_mv_karma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_stats_mv_karma ON public.user_stats_mv USING btree (total_karma DESC);


--
-- Name: idx_user_stats_mv_posts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_stats_mv_posts ON public.user_stats_mv USING btree (posts_count DESC);


--
-- Name: idx_user_stats_mv_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_stats_mv_username ON public.user_stats_mv USING btree (username);


--
-- Name: idx_user_subscriptions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_active ON public.user_subscriptions USING btree (is_active);


--
-- Name: idx_user_subscriptions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_expires_at ON public.user_subscriptions USING btree (expires_at);


--
-- Name: idx_user_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions USING btree (user_id);


--
-- Name: idx_user_translation_stats_user_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_translation_stats_user_month ON public.user_translation_stats USING btree (user_id, year_month);


--
-- Name: idx_user_wallets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_wallets_user_id ON public.user_wallets USING btree (user_id);


--
-- Name: idx_users_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted ON public.users USING btree (deleted);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_email_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email_verified ON public.users USING btree (is_email_verified);


--
-- Name: idx_users_language_preference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_language_preference ON public.users USING btree (language_preference);


--
-- Name: idx_users_registration_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_registration_date ON public.users USING btree (registration_date DESC);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_users_username_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username_verified ON public.users USING btree (username) WHERE ((is_email_verified = true) AND (deleted = false));


--
-- Name: avatar_items avatar_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_items
    ADD CONSTRAINT avatar_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.avatar_categories(id) ON DELETE CASCADE;


--
-- Name: avatar_items avatar_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_items
    ADD CONSTRAINT avatar_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: coin_payments coin_payments_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_payments
    ADD CONSTRAINT coin_payments_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.coin_packages(id) ON DELETE CASCADE;


--
-- Name: coin_payments coin_payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_payments
    ADD CONSTRAINT coin_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: coin_transactions coin_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: custom_themes custom_themes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_themes
    ADD CONSTRAINT custom_themes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: demo_mode_settings demo_mode_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_mode_settings
    ADD CONSTRAINT demo_mode_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: manual_payment_verifications manual_payment_verifications_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_payment_verifications
    ADD CONSTRAINT manual_payment_verifications_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: manual_payment_verifications manual_payment_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_payment_verifications
    ADD CONSTRAINT manual_payment_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: media media_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: media media_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: messages messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: payments payments_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.user_tiers(id) ON DELETE CASCADE;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post_boosts post_boosts_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_boosts
    ADD CONSTRAINT post_boosts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_boosts post_boosts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_boosts
    ADD CONSTRAINT post_boosts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_subthread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_subthread_id_fkey FOREIGN KEY (subthread_id) REFERENCES public.subthreads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: reactions reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: reactions reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: reactions reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: saved saved_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved
    ADD CONSTRAINT saved_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: saved saved_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved
    ADD CONSTRAINT saved_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: subscriptions subscriptions_subthread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subthread_id_fkey FOREIGN KEY (subthread_id) REFERENCES public.subthreads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: subthread_bans subthread_bans_banned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subthread_bans
    ADD CONSTRAINT subthread_bans_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subthread_bans subthread_bans_subthread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subthread_bans
    ADD CONSTRAINT subthread_bans_subthread_id_fkey FOREIGN KEY (subthread_id) REFERENCES public.subthreads(id) ON DELETE CASCADE;


--
-- Name: subthread_bans subthread_bans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subthread_bans
    ADD CONSTRAINT subthread_bans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subthreads subthreads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subthreads
    ADD CONSTRAINT subthreads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;


--
-- Name: tier_purchases tier_purchases_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_purchases
    ADD CONSTRAINT tier_purchases_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: tier_purchases tier_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_purchases
    ADD CONSTRAINT tier_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: translation_usage translation_usage_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_usage
    ADD CONSTRAINT translation_usage_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: translation_usage translation_usage_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_usage
    ADD CONSTRAINT translation_usage_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: translation_usage translation_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_usage
    ADD CONSTRAINT translation_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_avatars user_avatars_avatar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_avatars
    ADD CONSTRAINT user_avatars_avatar_id_fkey FOREIGN KEY (avatar_id) REFERENCES public.avatar_items(id) ON DELETE CASCADE;


--
-- Name: user_avatars user_avatars_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_avatars
    ADD CONSTRAINT user_avatars_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_custom_themes user_custom_themes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_themes
    ADD CONSTRAINT user_custom_themes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: user_roles user_roles_subthread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_subthread_id_fkey FOREIGN KEY (subthread_id) REFERENCES public.subthreads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: user_subscriptions user_subscriptions_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: user_subscriptions user_subscriptions_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.user_tiers(id) ON DELETE CASCADE;


--
-- Name: user_subscriptions user_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_translation_stats user_translation_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_translation_stats
    ADD CONSTRAINT user_translation_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_wallets user_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_wallets
    ADD CONSTRAINT user_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_current_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_current_tier_id_fkey FOREIGN KEY (current_tier_id) REFERENCES public.user_tiers(id) ON DELETE SET NULL;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

