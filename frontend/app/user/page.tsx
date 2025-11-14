"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Band = "LOW" | "MEDIUM" | "HIGH" | null;

type TopCategory = {
  category: string | null;
  count: number;
  totalAmount: number;
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

type LoadState = "idle" | "loading" | "ok" | "error";

export default function UserInsightsPage() {
  const searchParams = useSearchParams();
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingConsent, setUpdatingConsent] = useState(false);

  // customerId'yi URL'den oku
  useEffect(() => {
    const idParam = searchParams.get("customerId");
    const idNum = idParam ? Number(idParam) : 1;

    if (Number.isNaN(idNum)) {
      setCustomerId(null);
      setErrorMessage("Geçersiz customerId parametresi.");
      setState("error");
      return;
    }

    setCustomerId(idNum);
  }, [searchParams]);

  // summary fetch et
  useEffect(() => {
    if (customerId == null) return;

    setState("loading");
    setErrorMessage(null);

    fetch(`${backendUrl}/customers/${customerId}/summary`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Müşteri bulunamadı.");
          }
          throw new Error("İstek başarısız oldu.");
        }
        const data = await res.json();
        setSummary(data);
        setState("ok");
      })
      .catch((err: any) => {
        console.error("Failed to fetch customer summary:", err);
        setErrorMessage(err?.message || "Özet bilgisi alınamadı.");
        setState("error");
      });
  }, [backendUrl, customerId]);

  const renderBandBadge = (band: Band) => {
    if (!band) {
      return (
        <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
          No score yet
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

  const renderBody = () => {
    if (state === "loading" || customerId === null) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          Verilerin yüklenmesi bekleniyor...
        </div>
      );
    }

    if (state === "error") {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200">
          {errorMessage || "Bir hata oluştu."}
        </div>
      );
    }

    if (state === "ok" && summary) {
      const { customer, band, score, scoreCreatedAt, stats, consent } =
        summary;
      const { totalAmount90d, txCount90d, avgAmount90d, topCategories } =
        stats;

      const allowAnalytics =
        consent?.allowAnalytics !== undefined
          ? consent.allowAnalytics
          : true;

      const handleToggleConsent = async () => {
        if (!summary) return;

        const newValue = !allowAnalytics;
        setUpdatingConsent(true);

        try {
          const res = await fetch(
            `${backendUrl}/customers/${customer.id}/consent`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ allowAnalytics: newValue }),
            }
          );

          if (!res.ok) {
            throw new Error("Consent güncellenemedi.");
          }

          const data = await res.json();

          // Local state güncelle
          setSummary((prev) =>
            prev
              ? {
                  ...prev,
                  consent: {
                    allowAnalytics: data.allowAnalytics,
                  },
                  // İzni kapattıysa kullanıcıya temiz bir görünüm için
                  ...(newValue === false
                    ? {
                        score: null,
                        band: null,
                        scoreCreatedAt: null,
                        stats: {
                          totalAmount90d: 0,
                          txCount90d: 0,
                          avgAmount90d: 0,
                          topCategories: [],
                        },
                      }
                    : {}),
                }
              : prev
          );
        } catch (error) {
          console.error("Error updating consent:", error);
          alert("Analytics izni güncellenirken bir hata oluştu.");
        } finally {
          setUpdatingConsent(false);
        }
      };

      return (
        <div className="space-y-6">
          {/* Üst kart: Profil + risk + consent */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  {customer.name}
                </h2>
                <p className="text-xs text-slate-400">
                  Segment:{" "}
                  <span className="font-medium text-slate-200">
                    {customer.segment || "Bilinmiyor"}
                  </span>{" "}
                  · ID: {customer.id}
                </p>
                {customer.email && (
                  <p className="text-xs text-slate-500">
                    {customer.email}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Analytics izni:{" "}
                  <span
                    className={
                      allowAnalytics ? "text-emerald-300" : "text-red-300"
                    }
                  >
                    {allowAnalytics ? "Açık" : "Kapalı"}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {renderBandBadge(band)}
                  <p className="text-[11px] text-slate-400">
                    Score:{" "}
                    {typeof score === "number"
                      ? score.toFixed(2)
                      : "-"}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500">
                  Last updated:{" "}
                  {scoreCreatedAt
                    ? new Date(scoreCreatedAt).toLocaleString()
                    : "-"}
                </p>

                <button
                  onClick={handleToggleConsent}
                  disabled={updatingConsent}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingConsent ? (
                    <>
                      <span className="h-2 w-2 animate-spin rounded-full border border-slate-300 border-t-transparent" />
                      Güncelleniyor...
                    </>
                  ) : allowAnalytics ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      Analytics iznini kapat
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Analytics iznini aç
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Harcama özeti */}
          <section className="grid gap-4 md:grid-cols-3 text-xs md:text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
              <h3 className="font-semibold text-slate-100 text-sm">
                Son 90 günde toplam harcama
              </h3>
              <p className="text-emerald-300 text-base md:text-lg font-semibold">
                ₺ {totalAmount90d.toFixed(2)}
              </p>
              <p className="text-slate-400 text-[11px]">
                Yaklaşık toplam hacim (TRY)
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
              <h3 className="font-semibold text-slate-100 text-sm">
                İşlem sayısı (90 gün)
              </h3>
              <p className="text-slate-100 text-base md:text-lg font-semibold">
                {txCount90d}
              </p>
              <p className="text-slate-400 text-[11px]">
                İşlem sıklığı risk modeline girdi olarak kullanılıyor.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
              <h3 className="font-semibold text-slate-100 text-sm">
                Ortalama işlem tutarı
              </h3>
              <p className="text-slate-100 text-base md:text-lg font-semibold">
                ₺ {avgAmount90d.toFixed(2)}
              </p>
              <p className="text-slate-400 text-[11px]">
                Yüksek ortalama işlem tutarı risk skorunu yükseltebilir.
              </p>
            </div>
          </section>

          {/* Top categories */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-xs md:text-sm">
            <h3 className="font-semibold text-slate-100 text-sm">
              En çok harcama yapılan kategoriler (90 gün)
            </h3>
            {topCategories.length === 0 ? (
              <p className="text-slate-400 text-xs">
                Veri bulunamadı. Bu müşteri için ya son 90 günde işlem
                yok ya da analytics izni kapalı.
              </p>
            ) : (
              <ul className="space-y-2">
                {topCategories.map((cat, idx) => (
                  <li
                    key={`${cat.category}-${idx}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        #{idx + 1}
                      </span>
                      <span className="text-slate-100">
                        {cat.category || "Bilinmeyen"}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-100">
                        ₺ {cat.totalAmount.toFixed(2)}
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        {cat.count} işlem
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Küçük bilgi notu */}
          <section className="text-[11px] text-slate-500">
            URL&apos;deki <code className="rounded bg-slate-800 px-1">
              ?customerId=
            </code>{" "}
            parametresini değiştirerek (örn: <code>1</code>, <code>2</code>,{" "}
            <code>3</code>) farklı müşterilerin özetini görebilirsin. Analytics
            izni toggle&apos;ı her müşteri için ayrı çalışır.
          </section>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          My Privacy Insights
        </h1>
        <p className="text-slate-300 text-sm md:text-base max-w-2xl">
          Bu ekran, müşterinin kendi risk skorunu, harcama içgörülerini ve
          gizlilik odaklı analizin kısa özetini gösterir. Veriler BlindVault
          backend&apos;inden gerçek zamanlı olarak çekilir.
        </p>
      </section>

      {renderBody()}
    </div>
  );
}
