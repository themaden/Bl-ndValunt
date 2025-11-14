BlindVault – Privacy-Aware Risk Engine for Banks
“We have solved money, programmability, and scale. Privacy is the last piece of the puzzle.” BlindVault provides banks and fintechs with the necessary signal to understand customer behavior, but without exposing the customer's data nakedly.

🌍 Problem
In today's banking world:

Regulation (AML / KYC / risk monitoring) is becoming increasingly strict.

Customers have reached the point of saying, "analyze me, but don't strip me bare."

Banks possess massive amounts of transaction data but:

It's copied everywhere for analytics.

It creates serious risks regarding data privacy / security / KVKK / GDPR.

They cannot provide clear answers to the question, "Did I give consent, and where is it being used?"

The Result: Risk teams need more data, while privacy teams want less data to be used.

BlindVault is a small but real step aiming to resolve this conflict.

💡 Solution: BlindVault
BlindVault is a demo / MVP that can be installed within a bank's own infrastructure, featuring the following:

Bank Dashboard (/bank)

A list of all customers.

Latest risk scores + risk band (LOW / MEDIUM / HIGH).

A Consent column showing which customers have given analytics permission.

If consent is off, the bank officer cannot generate a new score for that customer.

User Privacy Insights (/user?customerId=1)

The customer can, on their side:

View their own risk score and spending summary.

Toggle the "Analytics Permission" On / Off with a single click.

When they turn the permission off:

The score and statistics are cleared on the user's screen.

The status on the Bank panel switches to "Consent off" (and the score cannot be recalculated).

Backend (Node + Express)

A simple but realistic data model working with customers, transactions, scores, and consents tables.

The transactions.raw_data field is encrypted with AES-256-GCM.

The Risk Engine generates a score based on 90 days of spending behavior.

In short: A transparent risk screen for the bank officer, a transparent privacy screen for the customer.

🧱 Architecture
Technical Stack:

Backend:

Node.js + Express

PostgreSQL

Connection via pg

AES-256-GCM encryption (Node crypto module)

Frontend:

Next.js (App Router)

React

Tailwind CSS

Infrastructure:

Postgres container via Docker Compose

.env environment variables

Data Model (Summary):

customers – Basic customer information.

transactions – Customer transaction records.

raw_data field is an encrypted JSON string.

scores – Risk scores generated for each customer.

consents – Analytics permission (on/off) for each customer.

🔐 Privacy Model
The current MVP employs a three-layered privacy approach:

Encryption (Encryption-at-rest)

The transactions.raw_data field is encrypted with AES-256-GCM.

Anyone directly opening the DB cannot see details like merchant / channel / country in the clear.

The encryption key is managed via the .env file using ENCRYPTION_KEY.

Consent Table (consents)

A single row per customer:

allow_analytics: boolean

In the Backend:

Checked using ensureAnalyticsAllowed(customerId).

If consent is missing (or false), the risk score calculation endpoint returns 403 Forbidden.

Privacy-aware API Response

The GET /customers/:id/summary endpoint:

If allow_analytics = false:

score = null, band = null

The stats field returns 0 / empty.

Thus:

Data does not exit the backend with full details without passing the "consent check" filter.

🧪 Endpoints
Health:

GET /health → { status: "ok", service: "blindvault-backend", timestamp: ... }

Customer List:

GET /customers → All customers

GET /customers/with-scores → Customers + latest risk score + allow_analytics

Consent:

GET /customers/:id/consent → { customerId, allowAnalytics }

PUT /customers/:id/consent Body: { "allowAnalytics": true | false } → Consolidated consent status

Summary:

GET /customers/:id/summary Returned structure:

JSON

{
  "customer": { ... },
  "consent": { "allowAnalytics": true },
  "score": 0.72,
  "band": "MEDIUM",
  "scoreCreatedAt": "2025-11-13T...",
  "stats": {
    "totalAmount90d": 12345.67,
    "txCount90d": 24,
    "avgAmount90d": 514.40,
    "topCategories": [
      { "category": "E-COMMERCE", "count": 10, "totalAmount": 5000.0 }
    ]
  }
}
🚀 Setup Steps
Bash

cd blindvault
sudo docker compose up -d
Bash

cd backend
cp .env.example .env    # if it doesn't exist
# Add DATABASE_URL and ENCRYPTION_KEY to the .env file

npm install
npm run seed    # inserts sample customer + transaction data
npm run dev     # backend starts on port 4000
Bash

cd frontend
cp .env.example .env    # if it doesn't exist
# Set NEXT_PUBLIC_BACKEND_URL (usually http://localhost:4000)

npm install
npm run dev     # frontend starts on port 3000
