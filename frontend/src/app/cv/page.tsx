"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, getLatestCV, getMatches, type CVLatest } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { useTheme } from "../ThemeProvider";

export default function CVPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [latest, setLatest] = useState<CVLatest | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [viewerHeight, setViewerHeight] = useState<string>("80vh");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return; // le composant est protégé par ailleurs via le dashboard
    (async () => {
      try {
        const cv = await getLatestCV();
        setLatest(cv);
      } catch (err: any) {
        // 404 si aucun CV encore
        if (err?.message?.includes("404")) {
          setLatest(null);
        } else {
          console.warn("latest cv error", err);
        }
      } finally {
        setLoadingLatest(false);
      }
    })();
  }, []);

  useEffect(() => {
    function updateHeight() {
      const available = window.innerHeight - 220; // laisse un peu de place pour le header/form
      setViewerHeight(`${Math.max(400, available)}px`);
    }
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  async function doUpload() {
    if (!file) {
      setMsg("Choisis un fichier PDF avant d'uploader.");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Le fichier doit être un PDF.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setError(null);
      await apiFetch("/cv/upload", {
        method: "POST",
        body: formData,
      });
      setMsg("CV uploadé avec succès");
      const cv = await getLatestCV();
      setLatest(cv);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setError(err?.message ?? "Erreur upload");
    }
    finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  async function upload() {
    if (!file) {
      setMsg("Choisis un fichier PDF avant d'uploader.");
      return;
    }
    try {
      const current = await getMatches(1, 1);
      if (current.items.length > 0) {
        setConfirmOpen(true);
        return;
      }
    } catch (_err) {
      // ignore warning
    }
    await doUpload();
  }

  const inputClass = isDark
    ? "mt-1 w-full rounded-xl border border-gray-700 bg-[#0d1016] px-3 py-2 text-gray-100 placeholder-gray-500"
    : "mt-1 w-full rounded-xl border px-3 py-2";
  const panelClass = isDark ? "mt-8 rounded-2xl border border-gray-700 p-4 bg-[#0f1116]" : "mt-8 rounded-2xl border p-4 bg-white";
  const textMuted = isDark ? "text-sm text-gray-400" : "text-sm text-gray-600";
  const btnPrimary = isDark
    ? "rounded-xl border border-gray-700 px-4 py-2 font-medium bg-[#0f1116] text-gray-100 hover:bg-gray-800 disabled:opacity-50"
    : "rounded-xl border px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50";
  const linkBtn = isDark
    ? "rounded-xl border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800"
    : "rounded-xl border px-4 py-2 text-sm hover:bg-gray-50";

  return (
    <main className={isDark ? "p-6 max-w-6xl mx-auto flex flex-col gap-6 bg-[#0b0c10] text-gray-100 theme-hover" : "p-6 max-w-6xl mx-auto flex flex-col gap-6 bg-white text-gray-900 theme-hover"}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CV</h1>
        <Link
          href="/dashboard"
          className={linkBtn}
        >
          ← Retour dashboard
        </Link>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Uploader ton CV</h2>

        <input
          type="file"
          accept="application/pdf"
          className="mt-3"
          ref={fileInputRef}
          onChange={(e) => {
            setMsg(null);
            setError(null);
            setFile(e.target.files?.[0] ?? null);
          }}
        />

        {file && (
          <p className={isDark ? "mt-2 text-sm text-gray-300" : "mt-2 text-sm text-gray-700"}>
            Fichier sélectionné : <span className="font-medium">{file.name}</span>
          </p>
        )}

        <button
          onClick={upload}
          className={`mt-4 ${btnPrimary}`}
          disabled={!file || loading}
        >
          {loading ? "Upload..." : "Uploader"}
        </button>

        {msg && <p className={isDark ? "mt-3 text-sm text-green-400" : "mt-3 text-sm text-green-700"}>{msg}</p>}
        {error && (
          <p className={isDark ? "mt-3 text-sm text-red-400" : "mt-3 text-sm text-red-700"}>
            {error}
          </p>
        )}
      </div>

      <div className={panelClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Dernier CV</h2>
            <p className={textMuted}>
              Aperçu rapide du fichier stocké.
            </p>
          </div>
          {latest && (
            <a
              className={isDark ? "text-sm underline text-blue-300 hover:text-blue-200" : "text-sm underline text-blue-700 hover:text-blue-900"}
              href={
                latest.url.startsWith("http")
                  ? latest.url
                  : (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000") + latest.url
              }
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir
            </a>
          )}
        </div>

        {loadingLatest && (
          <p className={textMuted}>Chargement...</p>
        )}

        {!loadingLatest && !latest && (
          <p className={textMuted}>
            Aucun CV stocké pour l’instant.
          </p>
        )}

        {latest && (
          <div className="mt-4 space-y-3">
            <p className={isDark ? "text-sm text-gray-200" : "text-sm text-gray-800"}>
              <span className="font-medium">Fichier :</span>{" "}
              {latest.filename}
            </p>
            <div className="mt-3 flex justify-center">
              {(() => {
                const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
                const pdfBase = latest.url.startsWith("http") ? latest.url : `${base}${latest.url}`;
                const pdfUrl = `${pdfBase}#toolbar=0&navpanes=0&scrollbar=0`;
                return (
                  <object
                    data={pdfUrl}
                    type="application/pdf"
                    className="w-full max-w-5xl border rounded-xl"
                    style={{ height: viewerHeight }}
                  >
                    <p className={textMuted}>
                      Aperçu indisponible.{" "}
                      <a
                        className={isDark ? "underline text-blue-300 hover:text-blue-200" : "underline text-blue-700 hover:text-blue-900"}
                        href={pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ouvrir le PDF
                      </a>
                    </p>
                  </object>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className={isDark ? "w-full max-w-sm rounded-xl bg-[#0f1116] border border-gray-700 p-4 shadow-xl text-gray-100" : "w-full max-w-sm rounded-xl bg-white p-4 shadow-xl"}>
            <h3 className={isDark ? "text-sm font-semibold text-gray-100" : "text-sm font-semibold text-gray-900"}>
              Supprimer les offres existantes ?
            </h3>
            <p className={isDark ? "mt-1 text-sm text-gray-300" : "mt-1 text-sm text-gray-600"}>
              Uploader un nouveau CV va vider les offres actuelles.
            </p>
            <div className="mt-4 flex justify-end gap-2 text-sm">
              <button
                className={isDark ? "rounded-md px-3 py-1.5 text-gray-200 hover:bg-gray-800 border border-gray-700" : "rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100"}
                onClick={() => setConfirmOpen(false)}
              >
                Annuler
              </button>
              <button
                className={isDark ? "rounded-md bg-red-900/40 border border-red-700 px-3 py-1.5 text-red-200 hover:bg-red-900/60 disabled:opacity-50" : "rounded-md bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100 disabled:opacity-50"}
                onClick={doUpload}
                disabled={loading}
              >
                {loading ? "…" : "Continuer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
