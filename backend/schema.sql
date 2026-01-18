CREATE TABLE public.comments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    post_id integer NOT NULL,
    parent_id integer,
    has_parent boolean,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_edited boolean DEFAULT false
);


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


CREATE TABLE public.reactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    post_id integer,
    comment_id integer,
    is_upvote boolean NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    email text NOT NULL,
    avatar text,
    bio text,
    language_preference varchar(3) DEFAULT 'en',
    theme varchar(10) DEFAULT 'light',
    registration_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted boolean DEFAULT false,
    is_email_verified boolean DEFAULT false
);


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

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;

CREATE TABLE public.messages (
    id integer NOT NULL,
    sender_id integer NOT NULL,
    receiver_id integer NOT NULL,
    content text NOT NULL,
    media text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    edited_at timestamp with time zone,
    seen boolean DEFAULT false NOT NULL,
    seen_at timestamp with time zone
);

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;

CREATE TABLE public.subthreads (
    id integer NOT NULL,
    name character varying(20) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    logo text,
    created_by integer
);

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

CREATE SEQUENCE public.posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;

CREATE SEQUENCE public.reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.reactions_id_seq OWNED BY public.reactions.id;

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL
);

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;

CREATE TABLE public.saved (
    id integer NOT NULL,
    user_id integer NOT NULL,
    post_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.saved_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.saved_id_seq OWNED BY public.saved.id;

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    user_id integer  NOT NULL,
    subthread_id integer  NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;

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

CREATE SEQUENCE public.subthreads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.subthreads_id_seq OWNED BY public.subthreads.id;

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

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    subthread_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);

ALTER TABLE ONLY public.posts ALTER COLUMN id SET DEFAULT nextval('public.posts_id_seq'::regclass);

ALTER TABLE ONLY public.reactions ALTER COLUMN id SET DEFAULT nextval('public.reactions_id_seq'::regclass);

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);

ALTER TABLE ONLY public.saved ALTER COLUMN id SET DEFAULT nextval('public.saved_id_seq'::regclass);

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);

ALTER TABLE ONLY public.subthreads ALTER COLUMN id SET DEFAULT nextval('public.subthreads_id_seq'::regclass);

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_comment_id_key UNIQUE (user_id, comment_id);

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_post_id_key UNIQUE (user_id, post_id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.saved
    ADD CONSTRAINT saved_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.saved
    ADD CONSTRAINT saved_user_id_post_id_key UNIQUE (user_id, post_id);

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
    
ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_subthread_id_key UNIQUE (user_id, subthread_id);

ALTER TABLE ONLY public.subthreads
    ADD CONSTRAINT subthreads_name_key UNIQUE (name);

ALTER TABLE ONLY public.subthreads
    ADD CONSTRAINT subthreads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_subthread_id_key UNIQUE (user_id, role_id, subthread_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_subthread_id_fkey FOREIGN KEY (subthread_id) REFERENCES public.subthreads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.saved
    ADD CONSTRAINT saved_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.saved
    ADD CONSTRAINT saved_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subthread_id_fkey FOREIGN KEY (subthread_id) REFERENCES public.subthreads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
    
ALTER TABLE ONLY public.subthreads
    ADD CONSTRAINT subthreads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_subthread_id_fkey FOREIGN KEY (subthread_id) REFERENCES public.subthreads(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;

INSERT INTO roles(name, slug) VALUES 
	('Thread Moderator','mod'),
	('Administrator', 'admin'),
    ('Member', 'member'),
    ('VIP','vip');

-- Add UserBlock table to track blocked users
CREATE TABLE IF NOT EXISTS user_blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (blocker_id, blocked_id)
);

-- Add table to track banned users per subthread
CREATE TABLE public.subthread_bans (
    id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subthread_id integer NOT NULL REFERENCES public.subthreads(id) ON DELETE CASCADE,
    banned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    banned_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    reason text DEFAULT 'Unspecific Ban Reason',
    CONSTRAINT subthread_bans_user_subthread_unique UNIQUE (user_id, subthread_id)
);

-- Auto-generated additions from check_schema_diff.py on 2025-07-20 01:53:40.480335
-- Missing schema elements found in remote database

-- Missing table: translation_cache
CREATE TABLE public.translation_cache (
    id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    content_hash varchar(64),
    source_language varchar(10),
    target_language varchar(10),
    original_text text,
    translated_text text,
    translation_method varchar(50),
    confidence_score double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_used timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    usage_count integer DEFAULT 1
);

-- Missing table: translation_usage
CREATE TABLE public.translation_usage (
    id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id integer,
    post_id integer,
    comment_id integer,
    source_language varchar(10) NOT NULL,
    target_language varchar(10) NOT NULL,
    original_text text NOT NULL,
    translated_text text NOT NULL,
    translation_method varchar(50) NOT NULL,
    confidence_score double precision,
    translated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Add translation limits table for user roles
CREATE TABLE public.translation_limits (
    id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    role_slug varchar(20) NOT NULL,
    daily_limit integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Insert default translation limits
INSERT INTO public.translation_limits (role_slug, daily_limit) VALUES
    ('member', 100),      -- Free users: 100/month
    ('support', 500),     -- Support: 500/month ($150k/month)
    ('vip', -1);          -- VIP: unlimited ($200k/month)

-- Add user translation stats table for tracking monthly usage
CREATE TABLE public.user_translation_stats (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    year_month varchar(7) NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
    translations_used integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, year_month)
);

-- Add index for better performance
CREATE INDEX idx_user_translation_stats_user_month 
ON public.user_translation_stats(user_id, year_month);

-- Add subscription system tables
CREATE TABLE public.subscriptions (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subscription_type varchar(20) NOT NULL CHECK (subscription_type IN ('support', 'vip')),
    status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone NOT NULL,
    payment_amount integer NOT NULL,
    payment_reference text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Add custom themes table
CREATE TABLE public.custom_themes (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    theme_name varchar(100) NOT NULL,
    theme_data jsonb NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for subscriptions
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON public.subscriptions(expires_at);

-- Add indexes for custom themes
CREATE INDEX idx_custom_themes_user_id ON public.custom_themes(user_id);
CREATE INDEX idx_custom_themes_active ON public.custom_themes(is_active);

-- Add subscription system tables for payment processing
CREATE TABLE public.user_tiers (
    id SERIAL PRIMARY KEY,
    name varchar(50) NOT NULL,
    slug varchar(50) NOT NULL UNIQUE,
    price_monthly numeric(10, 2) NOT NULL,
    max_subthreads integer,
    can_custom_theme boolean DEFAULT false,
    description text,
    features jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Insert default subscription tiers
INSERT INTO public.user_tiers (name, slug, price_monthly, max_subthreads, can_custom_theme, description, features) VALUES
    ('Free', 'member', 0.00, 3, false, 'Basic user tier with limited features', '{
        "benefits": [
            "Create up to 3 subthreads",
            "Basic theme support",
            "10MB file upload limit",
            "100 translations per month"
        ],
        "max_subthreads": 3,
        "theme_slots": 0,
        "upload_limit": 10485760,
        "translation_limit": 100
    }'::jsonb),
    ('Support', 'support', 150000.00, 10, true, 'Support the community and get exclusive features', '{
        "benefits": [
            "500 translations per month",
            "10 subthreads maximum",
            "Custom theme creation",
            "Priority support",
            "Larger file uploads (50MB)"
        ],
        "max_subthreads": 10,
        "theme_slots": 3,
        "upload_limit": 52428800,
        "translation_limit": 500
    }'::jsonb),
    ('VIP', 'vip', 200000.00, -1, true, 'Tier features and exclusive content', '{
        "benefits": [
            "Unlimited translations",
            "Unlimited subthreads",
            "Custom theme creation",
            "Priority support",
            "Maximum file uploads (100MB)",
            "Exclusive VIP badge"
        ],
        "max_subthreads": -1,
        "theme_slots": 10,
        "upload_limit": 104857600,
        "translation_limit": -1
    }'::jsonb);

-- Add payments table for tracking payment transactions
CREATE TABLE public.payments (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tier_id integer NOT NULL REFERENCES public.user_tiers(id) ON DELETE CASCADE,
    amount numeric(10, 2) NOT NULL,
    currency varchar(3) DEFAULT 'VND',
    momo_order_id varchar(100),
    momo_request_id varchar(100),
    momo_trans_id varchar(100),
    payment_status varchar(20) DEFAULT 'pending',
    payment_method varchar(50) DEFAULT 'momo',
    payment_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp with time zone,
    expires_at timestamp with time zone,
    callback_data jsonb,
    notes text
);

-- Add user_subscriptions table for active subscriptions
CREATE TABLE public.user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tier_id integer NOT NULL REFERENCES public.user_tiers(id) ON DELETE CASCADE,
    payment_id integer REFERENCES public.payments(id) ON DELETE SET NULL,
    starts_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    auto_renew boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    cancelled_at timestamp with time zone
);

-- Add user_custom_themes table for custom theme storage
CREATE TABLE public.user_custom_themes (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    theme_name varchar(100) NOT NULL,
    theme_data jsonb NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for subscription system tables
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(payment_status);
CREATE INDEX idx_payments_created_at ON public.payments(created_at);
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_tier_id ON public.user_subscriptions(tier_id);
CREATE INDEX idx_user_subscriptions_active ON public.user_subscriptions(is_active);
CREATE INDEX idx_user_subscriptions_expires_at ON public.user_subscriptions(expires_at);
CREATE INDEX idx_user_custom_themes_user_id ON public.user_custom_themes(user_id);
CREATE INDEX idx_user_custom_themes_active ON public.user_custom_themes(is_active);

-- Missing column: users.is_email_verified
ALTER TABLE public.users ADD COLUMN is_email_verified boolean NOT NULL DEFAULT false;

-- Missing column: users.email_verification_token
ALTER TABLE public.users ADD COLUMN email_verification_token text;

-- Missing column: users.email_verification_expires_at
ALTER TABLE public.users ADD COLUMN email_verification_expires_at timestamp with time zone;

ALTER TABLE public.users ADD COLUMN deleted boolean NOT NULL DEFAULT false;

-- Add coin system tables
CREATE TABLE public.user_wallets (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coin_balance integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Coin transaction history
CREATE TABLE public.coin_transactions (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    transaction_type varchar(50) NOT NULL CHECK (transaction_type IN ('purchase', 'tip_sent', 'tip_received', 'avatar_purchase', 'post_boost', 'tier_purchase', 'bonus')),
    amount integer NOT NULL,
    balance_after integer NOT NULL,
    reference_id integer, -- post_id, avatar_id, etc.
    reference_type varchar(50), -- 'post', 'avatar', 'tier', etc.
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Coin purchase packages
CREATE TABLE public.coin_packages (
    id SERIAL PRIMARY KEY,
    name varchar(100) NOT NULL,
    coin_amount integer NOT NULL,
    price_vnd integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Insert default coin packages
INSERT INTO public.coin_packages (name, coin_amount, price_vnd) VALUES
    ('100 Coins', 100, 10000),
    ('200 Coins', 200, 20000),
    ('500 Coins', 500, 50000),
    ('1000 Coins', 1000, 100000),
    ('2000 Coins', 2000, 200000);

-- Avatar categories
CREATE TABLE public.avatar_categories (
    id SERIAL PRIMARY KEY,
    name varchar(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Insert default avatar category
INSERT INTO public.avatar_categories (name, description) VALUES
    ('Mascot', 'Mascot-style avatars');

-- Avatar items
CREATE TABLE public.avatar_items (
    id SERIAL PRIMARY KEY,
    category_id integer NOT NULL REFERENCES public.avatar_categories(id) ON DELETE CASCADE,
    name varchar(200) NOT NULL,
    description text,
    image_url text NOT NULL,
    price_coins integer NOT NULL,
    is_active boolean DEFAULT true,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- User owned avatars
CREATE TABLE public.user_avatars (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    avatar_id integer NOT NULL REFERENCES public.avatar_items(id) ON DELETE CASCADE,
    is_equipped boolean DEFAULT false,
    purchased_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, avatar_id)
);

-- Post boosts
CREATE TABLE public.post_boosts (
    id SERIAL PRIMARY KEY,
    post_id integer NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    boost_start timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    boost_end timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Coin payments (similar to tier payments)
CREATE TABLE public.coin_payments (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    package_id integer NOT NULL REFERENCES public.coin_packages(id) ON DELETE CASCADE,
    amount numeric(10, 2) NOT NULL,
    coin_amount integer NOT NULL,
    currency varchar(3) DEFAULT 'VND',
    momo_order_id varchar(100),
    momo_request_id varchar(100),
    momo_trans_id varchar(100),
    payment_status varchar(20) DEFAULT 'pending',
    payment_method varchar(50) DEFAULT 'momo',
    payment_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp with time zone,
    expires_at timestamp with time zone,
    callback_data jsonb,
    notes text,
    is_first_purchase boolean DEFAULT false
);

-- Add SuperManager role
INSERT INTO public.roles(name, slug) VALUES 
    ('SuperManager', 'SM')
ON CONFLICT (slug) DO NOTHING;

-- Add indexes for coin system
CREATE INDEX idx_user_wallets_user_id ON public.user_wallets(user_id);
CREATE INDEX idx_coin_transactions_user_id ON public.coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_type ON public.coin_transactions(transaction_type);
CREATE INDEX idx_coin_transactions_created_at ON public.coin_transactions(created_at);
CREATE INDEX idx_avatar_items_category_id ON public.avatar_items(category_id);
CREATE INDEX idx_avatar_items_active ON public.avatar_items(is_active);
CREATE INDEX idx_user_avatars_user_id ON public.user_avatars(user_id);
CREATE INDEX idx_user_avatars_equipped ON public.user_avatars(is_equipped);
CREATE INDEX idx_post_boosts_post_id ON public.post_boosts(post_id);
CREATE INDEX idx_post_boosts_active ON public.post_boosts(is_active);
CREATE INDEX idx_post_boosts_end ON public.post_boosts(boost_end);
CREATE INDEX idx_coin_payments_user_id ON public.coin_payments(user_id);
CREATE INDEX idx_coin_payments_status ON public.coin_payments(payment_status);

-- Add new media table for multiple images/videos
CREATE TABLE public.media (
    id integer NOT NULL,
    post_id integer,
    comment_id integer,
    media_url text NOT NULL,
    media_type text NOT NULL,
    media_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT media_type_check CHECK (media_type IN ('image', 'video', 'gif'))
);

CREATE SEQUENCE public.media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;

-- Add indexes for media table
CREATE INDEX idx_media_post_id ON public.media(post_id);
CREATE INDEX idx_media_comment_id ON public.media(comment_id);
CREATE INDEX idx_media_order ON public.media(media_order);

-- Add media column to comments table for backward compatibility
ALTER TABLE public.comments ADD COLUMN media text;
