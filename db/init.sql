-- BlindVault initial schema

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    segment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TRY',
    category TEXT,
    tx_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_data TEXT, -- ileride şifrelenmiş JSON string olarak kullanılacak
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    score NUMERIC(5,4) NOT NULL, -- 0.0000 - 1.0000 arası
    band TEXT NOT NULL,          -- 'LOW', 'MEDIUM', 'HIGH'
    model_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consents (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    allow_analytics BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);