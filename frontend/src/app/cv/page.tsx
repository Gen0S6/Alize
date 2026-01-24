"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getLatestCV, getMatches, getAnalysis, type CVLatest, type Analysis } from "../../lib/api";
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
  const [viewerHeight, setViewerHeight] = useState<string>("70vh");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const cv = await getLatestCV();
        setLatest(cv);
        // Charger l'analyse si un CV existe
        if (cv) {
          setLoadingAnalysis(true);
          try {
            const analysisData = await getAnalysis();
            setAnalysis(analysisData);
          } catch {
            // Pas d'analyse disponible
          } finally {
            setLoadingAnalysis(false);
          }
        }
      } catch (err: any) {
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
      const available = window.innerHeight - 300;
      setViewerHeight(`${Math.max(400, available)}px`);
    }
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        setMsg(null);
        setError(null);
      } else {
        setError("Seuls les fichiers PDF sont acceptés.");
      }
    }
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
      setUploadProgress(0);

      // Simuler la progression
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      await apiFetch("/cv/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      setMsg("CV uploadé avec succès !");
      const cv = await getLatestCV();
      setLatest(cv);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Relancer l'analyse
      setLoadingAnalysis(true);
      try {
        const analysisData = await getAnalysis(true);
        setAnalysis(analysisData);
      } catch {
        // Pas d'analyse
      } finally {
        setLoadingAnalysis(false);
      }

      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err: any) {
      setError(err?.message ?? "Erreur upload");
      setUploadProgress(0);
    } finally {
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
    } catch {
      // ignore
    }
    await doUpload();
  }

  async function refreshAnalysis() {
    setLoadingAnalysis(true);
    try {
      const analysisData = await getAnalysis(true);
      setAnalysis(analysisData);
    } catch {
      setError("Impossible de charger l'analyse");
    } finally {
      setLoadingAnalysis(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  // Styles
  const cardClass = isDark
    ? "rounded-2xl border border-gray-700/50 bg-gradient-to-br from-[#0f1116] to-[#12141a] p-6 shadow-lg"
    : "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm";

  const textMuted = isDark ? "text-gray-400" : "text-gray-500";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-300" : "text-gray-700";

  const btnPrimary = isDark
    ? "rounded-xl bg-sky-600 hover:bg-sky-700 px-5 py-2.5 font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-600/20"
    : "rounded-xl bg-sky-600 hover:bg-sky-700 px-5 py-2.5 font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const btnSecondary = isDark
    ? "rounded-xl border border-gray-600 bg-[#0f1116] hover:bg-gray-800 px-4 py-2 font-medium text-gray-200 transition-all duration-200"
    : "rounded-xl border border-gray-300 bg-white hover:bg-gray-50 px-4 py-2 font-medium text-gray-700 transition-all duration-200";

  const badgeClass = (color: string) => {
    const colors: Record<string, string> = {
      blue: isDark ? "bg-sky-900/40 text-sky-300 border-sky-700/50" : "bg-sky-100/80 text-sky-800 border-sky-300",
      green: isDark ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/50" : "bg-emerald-100/80 text-emerald-800 border-emerald-300",
      purple: isDark ? "bg-purple-900/40 text-purple-300 border-purple-700/50" : "bg-purple-100/80 text-purple-800 border-purple-300",
      amber: isDark ? "bg-amber-900/40 text-amber-300 border-amber-700/50" : "bg-amber-100/80 text-amber-800 border-amber-300",
      gray: isDark ? "bg-gray-800 text-gray-300 border-gray-700" : "bg-gray-100 text-gray-600 border-gray-300",
    };
    return `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${colors[color] || colors.gray}`;
  };

  return (
    <main className={isDark ? "min-h-screen p-4 md:p-6 max-w-6xl mx-auto bg-[#0b0c10] text-gray-100" : "min-h-screen p-4 md:p-6 max-w-6xl mx-auto bg-white text-gray-900"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <span className={isDark ? "p-2.5 rounded-xl bg-gradient-to-br from-sky-600 to-sky-700 shadow-lg shadow-sky-600/20" : "p-2.5 rounded-xl bg-sky-600 shadow-md"}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            Mon CV
          </h1>
          <p className={`mt-2 ${textMuted}`}>Gère ton CV et visualise l'analyse de ton profil</p>
        </div>
        <Link href="/dashboard" className={btnSecondary}>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche - Upload et CV actuel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Zone d'upload */}
          <div className={cardClass}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${textPrimary}`}>
              <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Uploader un CV
            </h2>

            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200
                ${dragActive
                  ? (isDark ? "border-sky-500 bg-sky-900/20" : "border-sky-500 bg-sky-50")
                  : (isDark ? "border-gray-600 hover:border-gray-500 hover:bg-gray-800/50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50")
                }
              `}
            >
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => {
                  setMsg(null);
                  setError(null);
                  setFile(e.target.files?.[0] ?? null);
                }}
              />

              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                dragActive
                  ? (isDark ? "bg-sky-900/40" : "bg-sky-100")
                  : (isDark ? "bg-gray-800" : "bg-gray-100")
              }`}>
                <svg className={`w-8 h-8 ${dragActive ? "text-sky-400" : textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <p className={`text-sm font-medium ${textPrimary}`}>
                {dragActive ? "Dépose ton fichier ici" : "Glisse-dépose ton CV ici"}
              </p>
              <p className={`mt-1 text-xs ${textMuted}`}>
                ou clique pour parcourir tes fichiers
              </p>
              <p className={`mt-3 text-xs ${textMuted}`}>
                Format accepté : PDF uniquement
              </p>
            </div>

            {/* Fichier sélectionné */}
            {file && (
              <div className={`mt-4 p-4 rounded-xl flex items-center justify-between ${isDark ? "bg-gray-800/50 border border-gray-700" : "bg-gray-50 border border-gray-200"}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDark ? "bg-red-900/30" : "bg-red-100"}`}>
                    <svg className={`w-5 h-5 ${isDark ? "text-red-400" : "text-red-600"}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H11v6H9.5v-4.5h-1V13zm6 0c.8 0 1.5.7 1.5 1.5v3c0 .8-.7 1.5-1.5 1.5h-3V13h3zm0 4.5v-3h-1.5v3h1.5z"/>
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${textPrimary}`}>{file.name}</p>
                    <p className={`text-xs ${textMuted}`}>{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-200"}`}
                >
                  <svg className={`w-4 h-4 ${textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Barre de progression */}
            {uploadProgress > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className={textMuted}>Upload en cours...</span>
                  <span className={textMuted}>{uploadProgress}%</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Messages */}
            {msg && (
              <div className={`mt-4 p-3 rounded-xl flex items-center gap-2 ${isDark ? "bg-green-900/20 border border-green-700/50" : "bg-green-50 border border-green-200"}`}>
                <svg className={`w-5 h-5 ${isDark ? "text-green-400" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`text-sm ${isDark ? "text-green-300" : "text-green-700"}`}>{msg}</p>
              </div>
            )}
            {error && (
              <div className={`mt-4 p-3 rounded-xl flex items-center gap-2 ${isDark ? "bg-red-900/20 border border-red-700/50" : "bg-red-50 border border-red-200"}`}>
                <svg className={`w-5 h-5 ${isDark ? "text-red-400" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`text-sm ${isDark ? "text-red-300" : "text-red-700"}`}>{error}</p>
              </div>
            )}

            {/* Bouton upload */}
            <button
              onClick={upload}
              className={`mt-4 w-full ${btnPrimary}`}
              disabled={!file || loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Upload en cours...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Uploader le CV
                </span>
              )}
            </button>
          </div>

          {/* CV actuel */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${textPrimary}`}>
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CV actuel
              </h2>
              {latest && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPdfViewer(!showPdfViewer)}
                    className={btnSecondary}
                  >
                    {showPdfViewer ? "Masquer" : "Afficher"}
                  </button>
                  <a
                    className={btnSecondary}
                    href={
                      latest.url.startsWith("http")
                        ? latest.url
                        : (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000") + latest.url
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Ouvrir
                    </span>
                  </a>
                </div>
              )}
            </div>

            {loadingLatest && (
              <div className="space-y-3">
                <div className={`h-4 w-48 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`}></div>
                <div className={`h-4 w-32 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`}></div>
              </div>
            )}

            {!loadingLatest && !latest && (
              <div className={`text-center py-12 rounded-xl ${isDark ? "bg-gray-800/30" : "bg-gray-50"}`}>
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>
                  <svg className={`w-8 h-8 ${textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className={`font-medium ${textPrimary}`}>Aucun CV uploadé</p>
                <p className={`mt-1 text-sm ${textMuted}`}>
                  Uploade ton premier CV pour commencer
                </p>
              </div>
            )}

            {latest && (
              <div className="space-y-4">
                {/* Infos du fichier */}
                <div className={`p-4 rounded-xl flex items-center gap-4 ${isDark ? "bg-gray-800/50" : "bg-gray-50"}`}>
                  <div className={`p-3 rounded-xl ${isDark ? "bg-red-900/30" : "bg-red-100"}`}>
                    <svg className={`w-8 h-8 ${isDark ? "text-red-400" : "text-red-600"}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H11v6H9.5v-4.5h-1V13zm6 0c.8 0 1.5.7 1.5 1.5v3c0 .8-.7 1.5-1.5 1.5h-3V13h3zm0 4.5v-3h-1.5v3h1.5z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${textPrimary}`}>{latest.filename}</p>
                    <p className={`text-sm ${textMuted}`}>
                      Uploadé le {formatDate(latest.created_at)}
                    </p>
                  </div>
                </div>

                {/* Visualiseur PDF */}
                {showPdfViewer && (
                  <div className={`mt-4 rounded-xl overflow-hidden border ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                    {(() => {
                      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
                      const pdfUrl = latest.url.startsWith("http") ? latest.url : `${base}${latest.url}`;
                      return (
                        <iframe
                          src={pdfUrl}
                          className="w-full"
                          style={{ height: viewerHeight }}
                          title="Aperçu CV"
                        />
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite - Analyse */}
        <div className="space-y-6">
          {/* Carte d'analyse */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${textPrimary}`}>
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Analyse IA
              </h2>
              {latest && (
                <button
                  onClick={refreshAnalysis}
                  disabled={loadingAnalysis}
                  className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"} disabled:opacity-50`}
                  title="Relancer l'analyse"
                >
                  <svg className={`w-4 h-4 ${loadingAnalysis ? "animate-spin" : ""} ${textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {loadingAnalysis && (
              <div className="space-y-4">
                <div className={`h-4 w-full rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`}></div>
                <div className={`h-4 w-3/4 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`}></div>
                <div className={`h-4 w-1/2 rounded animate-pulse ${isDark ? "bg-gray-800" : "bg-gray-200"}`}></div>
              </div>
            )}

            {!loadingAnalysis && !analysis && (
              <div className={`text-center py-8 rounded-xl ${isDark ? "bg-gray-800/30" : "bg-gray-50"}`}>
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>
                  <svg className={`w-6 h-6 ${textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p className={`text-sm ${textMuted}`}>
                  {latest ? "Aucune analyse disponible" : "Uploade un CV pour voir l'analyse"}
                </p>
              </div>
            )}

            {!loadingAnalysis && analysis && (
              <div className="space-y-5">
                {/* Résumé */}
                {analysis.summary && (
                  <div>
                    <p className={`text-sm leading-relaxed ${textSecondary}`}>
                      {analysis.summary}
                    </p>
                  </div>
                )}

                {/* Poste cible */}
                {analysis.titre_poste_cible && (
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${textMuted}`}>Poste visé</p>
                    <p className={`font-semibold ${textPrimary}`}>{analysis.titre_poste_cible}</p>
                  </div>
                )}

                {/* Niveau d'expérience */}
                {(analysis.niveau_experience || analysis.experience_level) && (
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${textMuted}`}>Niveau</p>
                    <span className={badgeClass("purple")}>
                      {analysis.niveau_experience || analysis.experience_level}
                    </span>
                  </div>
                )}

                {/* Compétences techniques */}
                {analysis.competences_techniques && analysis.competences_techniques.length > 0 && (
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${textMuted}`}>
                      Compétences techniques
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.competences_techniques.slice(0, 8).map((skill, i) => (
                        <span key={i} className={badgeClass("blue")}>{skill}</span>
                      ))}
                      {analysis.competences_techniques.length > 8 && (
                        <span className={badgeClass("gray")}>+{analysis.competences_techniques.length - 8}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Compétences transversales */}
                {analysis.competences_transversales && analysis.competences_transversales.length > 0 && (
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${textMuted}`}>
                      Soft skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.competences_transversales.slice(0, 5).map((skill, i) => (
                        <span key={i} className={badgeClass("amber")}>{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Langues */}
                {analysis.langues && analysis.langues.length > 0 && (
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${textMuted}`}>Langues</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.langues.map((lang, i) => (
                        <span key={i} className={badgeClass("green")}>{lang}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formation */}
                {analysis.formation && (
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${textMuted}`}>Formation</p>
                    <p className={`text-sm ${textSecondary}`}>{analysis.formation}</p>
                  </div>
                )}

                {/* Mots-clés */}
                {analysis.top_keywords && analysis.top_keywords.length > 0 && (
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${textMuted}`}>Mots-clés principaux</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.top_keywords.slice(0, 6).map((kw, i) => (
                        <span key={i} className={badgeClass("gray")}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Requêtes suggérées */}
                {analysis.suggested_queries && analysis.suggested_queries.length > 0 && (
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${textMuted}`}>Requêtes de recherche</p>
                    <div className="space-y-1.5">
                      {analysis.suggested_queries.slice(0, 3).map((query, i) => (
                        <div
                          key={i}
                          className={`text-xs p-2 rounded-lg ${isDark ? "bg-gray-800/50" : "bg-gray-50"} ${textSecondary}`}
                        >
                          "{query}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lien vers le dashboard */}
          {analysis && (
            <Link
              href="/dashboard"
              className={`block text-center p-4 rounded-xl transition-all duration-200 ${
                isDark
                  ? "bg-gradient-to-r from-sky-900/40 to-purple-900/40 border border-sky-700/30 hover:border-sky-600/50"
                  : "bg-gradient-to-r from-sky-50 to-purple-50 border border-sky-200 hover:border-sky-300"
              }`}
            >
              <p className={`font-medium ${textPrimary}`}>Voir les offres correspondantes</p>
              <p className={`text-xs mt-1 ${textMuted}`}>Basées sur ton profil CV</p>
            </Link>
          )}
        </div>
      </div>

      {/* Modal de confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDark ? "bg-[#0f1116] border border-gray-700" : "bg-white"}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${isDark ? "bg-amber-900/30" : "bg-amber-100"}`}>
                <svg className={`w-6 h-6 ${isDark ? "text-amber-400" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>
                Remplacer le CV actuel ?
              </h3>
            </div>
            <p className={`text-sm ${textSecondary}`}>
              L'upload d'un nouveau CV va supprimer les offres d'emploi actuellement enregistrées.
              Une nouvelle recherche sera effectuée basée sur le nouveau CV.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                className={btnSecondary}
                onClick={() => setConfirmOpen(false)}
              >
                Annuler
              </button>
              <button
                className={`rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 font-medium text-white transition-colors disabled:opacity-50`}
                onClick={doUpload}
                disabled={loading}
              >
                {loading ? "Upload..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
