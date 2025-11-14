"use client";
import Link from "next/link";

import { useEffect, useState } from "react";

type ApiStatus = "loading" | "ok" | "error";

type Band = "LOW" | "MEDIUM" | "HIGH" | null;

type TopCategory = {
  category: string | null;
  count: number;
  totalAmount: number;
};

type CustomerWithScore = {
  id: number;
  name: string;
  email: string | null;
  segment: string | null;
  created_at: string;
  score: number | null;
  band: "LOW" | "MEDIUM" | "HIGH" | null;
  score_created_at: string | null;
  allow_analytics: boolean; // backend'den gelen COALESCE sonucu
};

type CustomerSummary = {
  customer: {
    id: number;
    name: string;
    email: string | null;
    segment: string | null;
    created_at: string;
  };
  consent?: {
    allowAnalytics: boolean;
  };
  score: number | null;
  band: Band;
  scoreCreatedAt: string | null;
  stats: {
    totalAmount90d: number;
    txCount90d: number;
    avgAmount90d: number;
    topCategories: TopCategory[];
  };
};

export default function BankDashboardPage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");
  const [backendInfo, setBackendInfo] = useState<{
    service?: string;
    timestamp?: string;
  }>({});

  const [customers, setCustomers] = useState<CustomerWithScore[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState<string | null>(
    null
  );
  const [recalculatingId, setRecalculatingId] = useState<number | null>(
    null
  );

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  // Health check
  useEffect(() => {
    fetch(`${backendUrl}/health`)
      .then(async (res) => {
        if (!res.ok) throw new Error("HTTP error");
        const data = await res.json();
        setApiStatus("ok");
        setBackendInfo({
          service: data.service,
          timestamp: data.timestamp,
        });
      })
      .catch(() => {
        setApiStatus("error");
      });
  }, [backendUrl]);

  // Customers + scores + consent fetch
  useEffect(() => {
    setCustomersLoading(true);
    setCustomersError(null);

    fetch(`${backendUrl}/customers/with-scores`)
      .then(async (res) => {
        if (!res.ok) throw new Error("HTTP error");
        const data = await res.json();
        setCustomers(data.data || []);
      })
      .catch((err) => {
        console.error("Failed to fetch customers with scores:", err);
        setCustomersError("Müşteri listesi alınırken bir hata oluştu.");
      })
      .finally(() => {
        setCustomersLoading(false);
      });
  }, [backendUrl]);

  const handleRecalculate = async (customerId: number) => {
    try {
      setRecalculatingId(customerId);

      const res = await fetch(`${backendUrl}/risk/score/${customerId}`, {
        method: "POST",
      });

      // Consent kapalıysa backend 403 dönecek
      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        alert(
          data?.error ||
            "Bu müşteri analytics'e izin vermediği için risk skoru hesaplanamıyor."
        );
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to recalculate score");
      }

      const data = await res.json();

      // Local state'i güncelle: ilgili müşterinin score + band değerini değiştir
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId
            ? {
                ...c,
                score: data.score,
                band: data.band,
                score_created_at: data.createdAt,
              }
            : c
        )
      );
    } catch (error) {
      console.error("Error recalculating score:", error);
      alert("Risk skoru hesaplanırken bir hata oluştu.");
    } finally {
      setRecalculatingId(null);
    }
  };

  const renderApiStatusLabel = () => {
    if (apiStatus === "loading") {
      return (
        <span className="inline-flex items-center gap-2 text-xs text-slate-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          Checking backend health...
        </span>
      );
    }

    if (apiStatus === "ok") {
      return (
        <span className="inline-flex items-center gap-2 text-xs text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Backend online
          {backendInfo.service && (
            <span className="text-slate-400">
              ({backendInfo.service.split("-").join(" ")})
            </span>
          )}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 text-xs text-red-400">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Backend unreachable
      </span>
    );
  };

  const renderBandBadge = (band: CustomerWithScore["band"]) => {
    if (!band) {
      return (
        <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
          No score
        </span>
      );
    }

    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
    if (band === "LOW") {
      return (
        <span className={`${base} bg-emerald-500/10 text-emerald-300`}>
          LOW
        </span>
      );
    }
    if (band === "MEDIUM") {
      return (
        <span className={`${base} bg-amber-500/10 text-amber-300`}>
          MEDIUM
        </span>
      );
    }
    return (
      <span className={`${base} bg-red-500/10 text-red-300`}>HIGH</span>
    );
  };

  const renderConsentBadge = (allow: boolean) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
    if (allow) {
      return (
        <span className={`${base} bg-emerald-500/10 text-emerald-300`}>
          On
        </span>
      );
    }
    return (
      <span className={`${base} bg-red-500/10 text-red-300`}>Off</span>
    );
  };

  // 🔢 Özet metrikler (frontend’de derive)
  const totalCustomers = customers.length;
  const consentOn = customers.filter((c) => c.allow_analytics).length;
  const scoredCustomers = customers.filter(
    (c) => typeof c.score === "number"
  ).length;
  const highRiskCustomers = customers.filter(
    (c) => c.band === "HIGH"
  ).length;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Bank Dashboard
            </h1>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl">
              Burada, müşterilerin risk skorlarını, risk band dağılımlarını ve
              BlindVault motorundan gelen agregasyonları göreceksin. Şu anda
              tablo, backend&apos;deki gerçek müşteriler ve hesaplanmış risk
              skorları ile besleniyor. Consent sütunu, hangi müşterinin
              analitik izni verdiğini gösterir.
            </p>
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
            {renderApiStatusLabel()}
          </div>
        </div>
      </section>

      {/* 🧾 Özet kartlar */}
      <section className="grid gap-4 md:grid-cols-4 text-xs md:text-sm">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <h3 className="font-semibold text-slate-100 text-sm">
            Toplam müşteri
          </h3>
          <p className="text-slate-100 text-base md:text-lg font-semibold">
            {customersLoading ? "…" : totalCustomers}
          </p>
          <p className="text-slate-400 text-[11px]">
            Risk motoruna bağlı mevcut müşteri sayısı.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <h3 className="font-semibold text-slate-100 text-sm">
            Consent açık
          </h3>
          <p className="text-emerald-300 text-base md:text-lg font-semibold">
            {customersLoading ? "…" : consentOn}
          </p>
          <p className="text-slate-400 text-[11px]">
            Analitik izni veren müşteri sayısı. (Privacy-aware adoption
            metriği)
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <h3 className="font-semibold text-slate-100 text-sm">
            Skoru hesaplanmış
          </h3>
          <p className="text-slate-100 text-base md:text-lg font-semibold">
            {customersLoading ? "…" : scoredCustomers}
          </p>
          <p className="text-slate-400 text-[11px]">
            En az 1 kez risk skoru üretilmiş müşteri sayısı.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <h3 className="font-semibold text-slate-100 text-sm">
            Yüksek riskli
          </h3>
          <p className="text-red-300 text-base md:text-lg font-semibold">
            {customersLoading ? "…" : highRiskCustomers}
          </p>
          <p className="text-slate-400 text-[11px]">
            HIGH band&apos;deki müşteri adedi (erken uyarı göstergesi).
          </p>
        </div>
      </section>

      {/* Tablo */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">
            Müşteriler ve Risk Skorları
          </h2>
          {customersLoading && (
            <span className="text-xs text-slate-400">
              Müşteriler yükleniyor...
            </span>
          )}
        </div>

        {customersError && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {customersError}
          </div>
        )}

        {!customersLoading && customers.length === 0 && !customersError && (
          <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            Henüz kayıtlı müşteri bulunmuyor. (Seed script çalıştırıldı mı?)
          </div>
        )}

        {customers.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">
                    ID
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">
                    Segment
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">
                    Consent
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">
                    Risk Band
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">
                    Score
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">
                    Last Updated
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-slate-800/80 hover:bg-slate-900/80"
                  >
                    <td className="px-3 py-2 align-middle text-slate-400">
                      {c.id}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-100">
                      {c.name}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-300">
                      {c.segment || "-"}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {renderConsentBadge(c.allow_analytics)}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {renderBandBadge(c.band)}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-300">
                      {typeof c.score === "number"
                        ? c.score.toFixed(2)
                        : "-"}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-400">
                      {c.score_created_at
                        ? new Date(c.score_created_at).toLocaleString()
                        : "-"}
                    </td>
                     <td className="px-3 py-2 align-middle text-right">
  <button
    onClick={() => handleRecalculate(c.id)}
    disabled={
      recalculatingId === c.id || !c.allow_analytics
    }
    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {recalculatingId === c.id ? (
      <>
        <span className="h-2 w-2 animate-spin rounded-full border border-emerald-300 border-t-transparent" />
        Recalculating...
      </>
    ) : !c.allow_analytics ? (
      <>
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Consent off
      </>
    ) : c.band ? (
      <>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
        Recalculate
      </>
    ) : (
      <>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
        Calculate
      </>
    )}
  </button>
</td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
