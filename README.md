# BlindVault – Privacy-Aware Risk Engine for Banks

> “Parayı, programlanabilirliği ve ölçeği çözdük. Gizlilik bulmacanın son parçası.”  
> BlindVault, bankalara ve fintech’lere **müşteri davranışını anlamak için gerekli sinyali** veriyor,  
> ama **müşterinin verisini çıplak şekilde açığa çıkarmadan**.

## 🌍 Problem

Bugünün bankacılık dünyasında:

- Regülasyon (AML / KYC / risk izleme) giderek sıkılaşıyor.
- Müşteriler “*beni analiz edin ama çıplak hale getirmeyin*” noktasına geldi.
- Bankaların elinde **yüklü miktarda işlem verisi** var ama:
  - Analitik için her yere kopyalanıyor,
  - Data privacy / güvenlik / KVKK / GDPR tarafında ciddi risk yaratıyor,
  - “Onay verdim mi, nerede kullanılıyor?” sorusuna net cevap verilemiyor.

Sonuç:  
**Risk ekipleri daha çok veriye ihtiyaç duyarken, gizlilik ekipleri daha az veri kullanılmasını istiyor.**

BlindVault bu çatışmayı çözmeyi hedefleyen küçük ama gerçek bir adım.

---

## 💡 Çözüm: BlindVault

BlindVault, bankaların kendi altyapısına kurulabilen, şu özelliklere sahip bir demo / MVP’dir:

- **Bank Dashboard (`/bank`)**
  - Tüm müşterilerin listesi
  - Son risk skorları + risk bandı (LOW / MEDIUM / HIGH)
  - Hangi müşterinin analitik izni (consent) verdiğini gösteren **Consent sütunu**
  - Consent kapalıysa, bankacı o müşteri için yeni skor üretemez
- **User Privacy Insights (`/user?customerId=1`)**
  - Müşteri kendi tarafında:
    - Kendi risk skorunu ve harcama özetini görebilir
    - “Analytics izni”ni tek tıkla **Aç / Kapat** yapabilir
  - İzni kapattığında:
    - Skor ve istatistikler kullanıcı ekranında temizlenir
    - Banka panelinde “Consent off” durumuna düşer (ve skor tekrar hesaplanamaz)
- **Backend (Node + Express)**
  - `customers`, `transactions`, `scores`, `consents` tablolarıyla çalışan basit ama gerçekçi bir veri modeli
  - `transactions.raw_data` alanı **AES-256-GCM ile şifrelenmiş** durumda
  - Risk motoru 90 günlük harcama davranışına göre skor üretir

> Kısaca:  
> **Bankacı için şeffaf risk ekranı**, **müşteri için şeffaf gizlilik ekranı**.

---

## 🧱 Mimari

**Teknik stack:**

- Backend:
  - Node.js + Express
  - PostgreSQL
  - `pg` ile bağlantı
  - AES-256-GCM ile şifreleme (Node `crypto` modülü)
- Frontend:
  - Next.js (App Router)
  - React
  - Tailwind CSS
- Altyapı:
  - Docker Compose ile Postgres container
  - `.env` ortam değişkenleri

**Veri modeli (özet):**

- `customers` – Müşteri temel bilgileri
- `transactions` – Müşteriye ait işlem kayıtları
  - `raw_data` alanı **şifreli JSON string**
- `scores` – Her müşteri için üretilmiş risk skorları
- `consents` – Her müşteri için **analytics izni** (on/off)

---

## 🔐 Gizlilik Modeli

Şu anda MVP’de üç katmanlı bir gizlilik yaklaşımı var:

1. **Şifreleme (Encryption-at-rest)**
   - `transactions.raw_data` alanı AES-256-GCM ile şifrelenmiş durumda.
   - DB’yi doğrudan açan biri merchant / channel / country gibi detayları **çıplak göremiyor**.
   - Şifreleme anahtarı `ENCRYPTION_KEY` ile `.env` üzerinden yönetiliyor.

2. **Consent tablosu (`consents`)**
   - Her müşteri için tek satır:
     - `allow_analytics: boolean`
   - Backend’te:
     - `ensureAnalyticsAllowed(customerId)` ile kontrol ediliyor.
     - Consent yoksa (veya false ise) risk skoru hesaplama endpoint’i 403 dönüyor.

3. **Privacy-aware API Response**
   - `GET /customers/:id/summary` endpoint’i:
     - Eğer `allow_analytics = false` ise:
       - `score = null`, `band = null`
       - `stats` alanı 0 / boş dönüyor
   - Böylece:
     - Data, backend içinde bile **“izin var” filtresinden geçmeden** full detaylı çıkmıyor.

---

## 🧪 Endpoint’ler

**Health:**

- `GET /health`  
  → `{ status: "ok", service: "blindvault-backend", timestamp: ... }`

**Müşteri listesi:**

- `GET /customers`  
  → Tüm müşteriler

- `GET /customers/with-scores`  
  → Müşteriler + son risk skoru + `allow_analytics`

**Consent:**

- `GET /customers/:id/consent`  
  → `{ customerId, allowAnalytics }`

- `PUT /customers/:id/consent`  
  Body: `{ "allowAnalytics": true | false }`  
  → Konsolide consent durumu

**Özet:**

- `GET /customers/:id/summary`  
  Dönen yapı:
  ```json
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


cd blindvault
sudo docker compose up -d


cd backend
cp .env.example .env   # yoksa
# .env dosyasına DATABASE_URL ve ENCRYPTION_KEY ekle

npm install
npm run seed   # örnek müşteri + işlem verisi basar
npm run dev    # backend 4000 portunda açılır


cd frontend
cp .env.example .env   # yoksa
# NEXT_PUBLIC_BACKEND_URL ayarla (genelde http://localhost:4000)

npm install
npm run dev    # frontend 3000 portunda açılır
