"use client";

import * as React from "react";
import {
  AlertCircle,
  Archive,
  Bot,
  Brain,
  ChevronDown,
  Clock3,
  FileText,
  FileType2,
  History,
  LayoutDashboard,
  Loader2,
  Mail,
  Menu,
  Mic,
  MicOff,
  PanelLeft,
  RefreshCw,
  ScrollText,
  Search,
  Send,
  Settings2,
  Shield,
  Sparkles,
  Wand2,
  Workflow,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  usePierreMissionCenter,
  type PierreDocument,
  type PierreOutboundEmail,
  type PierreTask,
} from "@/hooks/pierre/usePierreMissionCenter";
import { usePierreHistory } from "@/hooks/pierre/usePierreHistory";
import { usePierreCompanyMemory } from "@/hooks/pierre/usePierreCompanyMemory";

import { PierreStatusBadge } from "@/components/pierre/PierreStatusBadge";
import { PierreMissionComposer } from "@/components/pierre/PierreMissionComposer";
import { PierreMissionUnderstanding } from "@/components/pierre/PierreMissionUnderstanding";
import { PierreExecutionBoard } from "@/components/pierre/PierreExecutionBoard";
import { PierreTaskList } from "@/components/pierre/PierreTaskList";
import { PierreHistoryPanel } from "@/components/pierre/PierreHistoryPanel";
import { PierreMemoryPanel } from "@/components/pierre/PierreMemoryPanel";
import { PierreDocumentPanel } from "@/components/pierre/PierreDocumentPanel";
import { PierreMissionTimeline } from "@/components/pierre/PierreMissionTimeline";

type MainSection =
  | "cockpit"
  | "missions"
  | "studios"
  | "followup"
  | "artifacts"
  | "history"
  | "memory";

type StudioMode = "employee" | "email" | "document" | "pdf";
type ArtifactTab = "documents" | "emails" | "pdfs";
type VoiceTarget =
  | "employeeDraft"
  | "emailSubject"
  | "emailBody"
  | "documentInstructions"
  | "documentContext"
  | "pdfText"
  | null;

type BusyAction =
  | null
  | "submit-mission"
  | "generate-document"
  | "draft-email"
  | "send-email"
  | "generate-pdf"
  | "refresh";

type ThreadEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

type EmailComposerState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
};

type DocumentComposerState = {
  title: string;
  instructions: string;
  context: string;
  tone: string;
  language: string;
};

type PdfComposerState = {
  title: string;
  text: string;
};

type LocalSnapshot = {
  mainSection: MainSection;
  studioMode: StudioMode;
  artifactTab: ArtifactTab;
  employeeDraft: string;
  threadEntries: ThreadEntry[];
  emailComposer: EmailComposerState;
  documentComposer: DocumentComposerState;
  pdfComposer: PdfComposerState;
  focusedMissionId: string | null;
  selectedDocumentId: string | null;
  selectedEmailId: string | null;
  selectedPdfId: string | null;
  leftCollapsed: boolean;
};

const STORAGE_KEY = "clonestore:pierre:use-page:v5";

const StatusBadgeAny = PierreStatusBadge as React.ComponentType<any>;
const MissionComposerAny = PierreMissionComposer as React.ComponentType<any>;
const TaskListAny = PierreTaskList as React.ComponentType<any>;
const HistoryPanelAny = PierreHistoryPanel as React.ComponentType<any>;
const MemoryPanelAny = PierreMemoryPanel as React.ComponentType<any>;
const DocumentPanelAny = PierreDocumentPanel as React.ComponentType<any>;
const MissionUnderstandingAny = PierreMissionUnderstanding as React.ComponentType<any>;
const ExecutionBoardAny = PierreExecutionBoard as React.ComponentType<any>;
const TimelineAny = PierreMissionTimeline as React.ComponentType<any>;

const fieldClass =
  "w-full rounded-[18px] border border-[#e7d9c8] bg-white px-4 py-3 text-sm text-[#2a2118] outline-none transition placeholder:text-[#a18c77] focus:border-[#d8bd9d] focus:ring-4 focus:ring-[#f3e6d6]";

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function splitEmails(value: string): string[] {
  return value
    .split(/[,\n;]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getStatusCount(tasks: PierreTask[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return tasks.filter((task) => set.has(String(task.status ?? "").toLowerCase())).length;
}

function relatedDocumentForTask(task: PierreTask, documents: PierreDocument[]) {
  return (
    documents.find((doc) => doc.task_id && doc.task_id === task.id) ??
    documents.find((doc) => doc.mission_id && doc.mission_id === task.mission_id) ??
    null
  );
}

function relatedEmailForTask(task: PierreTask, emails: PierreOutboundEmail[]) {
  return (
    emails.find((mail) => mail.task_id && mail.task_id === task.id) ??
    emails.find((mail) => mail.mission_id && mail.mission_id === task.mission_id) ??
    null
  );
}

function shellPanel() {
  return "rounded-[28px] border border-[#e9dfd2] bg-[#fffaf3] shadow-[0_14px_50px_rgba(94,78,56,0.08)]";
}

function softPanel() {
  return "rounded-[24px] border border-[#eadfce] bg-[#fffdf9]";
}

export default function PierreUsePage() {
  const missionCenter = usePierreMissionCenter();
  const history = usePierreHistory();
  const memory = usePierreCompanyMemory();

  const [mainSection, setMainSection] = React.useState<MainSection>("missions");
  const [studioMode, setStudioMode] = React.useState<StudioMode>("employee");
  const [artifactTab, setArtifactTab] = React.useState<ArtifactTab>("documents");

  const [employeeDraft, setEmployeeDraft] = React.useState("");
  const [threadEntries, setThreadEntries] = React.useState<ThreadEntry[]>([]);

  const [emailComposer, setEmailComposer] = React.useState<EmailComposerState>({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
  });

  const [documentComposer, setDocumentComposer] = React.useState<DocumentComposerState>({
    title: "",
    instructions: "",
    context: "",
    tone: "professionnel",
    language: "fr",
  });

  const [pdfComposer, setPdfComposer] = React.useState<PdfComposerState>({
    title: "",
    text: "",
  });

  const [directDocuments, setDirectDocuments] = React.useState<PierreDocument[]>([]);
  const [directEmails, setDirectEmails] = React.useState<PierreOutboundEmail[]>([]);
  const [directPdfs, setDirectPdfs] = React.useState<Record<string, unknown>[]>([]);

  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = React.useState<string | null>(null);
  const [selectedPdfId, setSelectedPdfId] = React.useState<string | null>(null);

  const [busyAction, setBusyAction] = React.useState<BusyAction>(null);
  const [leftCollapsed, setLeftCollapsed] = React.useState(false);
  const [topMenuOpen, setTopMenuOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [commandSearch, setCommandSearch] = React.useState("");

  const [voiceSupported, setVoiceSupported] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [voiceTarget, setVoiceTarget] = React.useState<VoiceTarget>(null);
  const [voiceInterim, setVoiceInterim] = React.useState("");
  const [voiceError, setVoiceError] = React.useState<string | null>(null);

  const recognitionRef = React.useRef<any>(null);

  React.useEffect(() => {
    const saved = parseJson<LocalSnapshot>(window.localStorage.getItem(STORAGE_KEY));
    if (!saved) return;

    setMainSection(saved.mainSection ?? "missions");
    setStudioMode(saved.studioMode ?? "employee");
    setArtifactTab(saved.artifactTab ?? "documents");
    setEmployeeDraft(saved.employeeDraft ?? "");
    setThreadEntries(saved.threadEntries ?? []);
    setEmailComposer(
      saved.emailComposer ?? {
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
      }
    );
    setDocumentComposer(
      saved.documentComposer ?? {
        title: "",
        instructions: "",
        context: "",
        tone: "professionnel",
        language: "fr",
      }
    );
    setPdfComposer(saved.pdfComposer ?? { title: "", text: "" });
    missionCenter.setFocusedMissionId(saved.focusedMissionId ?? null);
    setSelectedDocumentId(saved.selectedDocumentId ?? null);
    setSelectedEmailId(saved.selectedEmailId ?? null);
    setSelectedPdfId(saved.selectedPdfId ?? null);
    setLeftCollapsed(Boolean(saved.leftCollapsed));
  }, [missionCenter]);

  React.useEffect(() => {
    const snapshot: LocalSnapshot = {
      mainSection,
      studioMode,
      artifactTab,
      employeeDraft,
      threadEntries,
      emailComposer,
      documentComposer,
      pdfComposer,
      focusedMissionId: missionCenter.focusedMissionId,
      selectedDocumentId,
      selectedEmailId,
      selectedPdfId,
      leftCollapsed,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    mainSection,
    studioMode,
    artifactTab,
    employeeDraft,
    threadEntries,
    emailComposer,
    documentComposer,
    pdfComposer,
    missionCenter.focusedMissionId,
    selectedDocumentId,
    selectedEmailId,
    selectedPdfId,
    leftCollapsed,
  ]);

  React.useEffect(() => {
    void history.refresh({ includeTasks: true });
    void memory.refresh();
  }, [history, memory]);

  React.useEffect(() => {
    if (!missionCenter.focusedMissionId) return;
    void missionCenter.refreshMission(missionCenter.focusedMissionId);
  }, [missionCenter.focusedMissionId]);

  React.useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
    setVoiceSupported(Boolean(SpeechRecognitionCtor));

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
      setVoiceInterim("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }

      setVoiceInterim(interim);

      if (finalText.trim()) {
        const clean = finalText.trim();

        switch (voiceTarget) {
          case "employeeDraft":
            setEmployeeDraft((prev) => [prev, clean].filter(Boolean).join(" ").trim());
            break;
          case "emailSubject":
            setEmailComposer((prev) => ({
              ...prev,
              subject: [prev.subject, clean].filter(Boolean).join(" ").trim(),
            }));
            break;
          case "emailBody":
            setEmailComposer((prev) => ({
              ...prev,
              body: [prev.body, clean].filter(Boolean).join("\n\n").trim(),
            }));
            break;
          case "documentInstructions":
            setDocumentComposer((prev) => ({
              ...prev,
              instructions: [prev.instructions, clean].filter(Boolean).join(" ").trim(),
            }));
            break;
          case "documentContext":
            setDocumentComposer((prev) => ({
              ...prev,
              context: [prev.context, clean].filter(Boolean).join(" ").trim(),
            }));
            break;
          case "pdfText":
            setPdfComposer((prev) => ({
              ...prev,
              text: [prev.text, clean].filter(Boolean).join("\n\n").trim(),
            }));
            break;
          default:
            break;
        }
      }
    };

    recognition.onerror = (event: any) => {
      setVoiceError(
        event?.error === "not-allowed"
          ? "Accès micro refusé."
          : "La saisie vocale a rencontré une erreur."
      );
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setVoiceInterim("");
      setVoiceTarget(null);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        //
      }
      recognitionRef.current = null;
    };
  }, [voiceTarget]);

  React.useEffect(() => {
    if (!missionCenter.hasActiveTask || !missionCenter.focusedMissionId) return;

    const timer = window.setInterval(() => {
      void missionCenter.refreshMission(missionCenter.focusedMissionId);
    }, 12000);

    return () => window.clearInterval(timer);
  }, [missionCenter.hasActiveTask, missionCenter.focusedMissionId, missionCenter.refreshMission]);

  const mergedDocuments = React.useMemo(() => {
    const map = new Map<string, PierreDocument>();
    [...directDocuments, ...missionCenter.documents].forEach((doc) => map.set(doc.id, doc));
    return Array.from(map.values()).sort((a, b) => {
      const da = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const db = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return db - da;
    });
  }, [directDocuments, missionCenter.documents]);

  const mergedEmails = React.useMemo(() => {
    const map = new Map<string, PierreOutboundEmail>();
    [...directEmails, ...missionCenter.outboundEmails].forEach((mail) => map.set(mail.id, mail));
    return Array.from(map.values()).sort((a, b) => {
      const da = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const db = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return db - da;
    });
  }, [directEmails, missionCenter.outboundEmails]);

  const activeMissionTasks = missionCenter.tasks;
  const runningCount = getStatusCount(activeMissionTasks, ["running", "in_progress"]);
  const queuedCount = getStatusCount(activeMissionTasks, ["queued", "ready", "planned", "retry"]);
  const approvalCount = getStatusCount(activeMissionTasks, [
    "awaiting_validation",
    "awaiting_approval",
  ]);
  const awaitingInfoCount = getStatusCount(activeMissionTasks, ["awaiting_info"]);
  const completedCount = getStatusCount(activeMissionTasks, ["completed", "done"]);
  const blockedCount = getStatusCount(activeMissionTasks, ["blocked", "failed", "cancelled"]);
  const missionArtifactsCount = mergedDocuments.length + mergedEmails.length + directPdfs.length;

  const selectedDocument = React.useMemo(
    () => mergedDocuments.find((doc) => doc.id === selectedDocumentId) ?? null,
    [mergedDocuments, selectedDocumentId]
  );

  const selectedEmail = React.useMemo(
    () => mergedEmails.find((mail) => mail.id === selectedEmailId) ?? null,
    [mergedEmails, selectedEmailId]
  );

  const selectedPdf = React.useMemo(
    () => directPdfs.find((pdf) => String(pdf.id ?? "") === selectedPdfId) ?? null,
    [directPdfs, selectedPdfId]
  );

  const filteredHistory = React.useMemo(() => {
    const q = commandSearch.trim().toLowerCase();
    if (!q) return history.items.slice(0, 10);
    return history.items
      .filter((item: any) => {
        const hay = [item.title, item.subtitle, item.status, item.kind, item.mission_id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 10);
  }, [commandSearch, history.items]);

  const pushThread = React.useCallback((entry: ThreadEntry) => {
    setThreadEntries((prev) => [entry, ...prev].slice(0, 40));
  }, []);

  const startVoice = React.useCallback(
    (target: VoiceTarget) => {
      if (!voiceSupported || !recognitionRef.current) return;
      setVoiceError(null);
      setVoiceTarget(target);
      try {
        recognitionRef.current.start();
      } catch {
        setVoiceError("Impossible de démarrer la saisie vocale.");
        setVoiceTarget(null);
      }
    },
    [voiceSupported]
  );

  const stopVoice = React.useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      //
    }
    setIsListening(false);
    setVoiceTarget(null);
    setVoiceInterim("");
  }, []);

  const handleRefreshAll = React.useCallback(async () => {
    setBusyAction("refresh");
    try {
      await Promise.all([
        history.refresh({ includeTasks: true }),
        memory.refresh(),
        missionCenter.refreshMission(),
      ]);
    } finally {
      setBusyAction(null);
    }
  }, [history, memory, missionCenter]);

  const handleSubmitMission = React.useCallback(async () => {
    const text = employeeDraft.trim();
    if (!text) return;

    setBusyAction("submit-mission");

    try {
      pushThread({
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      });

      const payload = await missionCenter.submitMission({
        input: text,
        mode: "employee",
      });

      const summary =
        payload.interpretation?.suggested_reply ??
        payload.interpretation?.summary ??
        payload.mission?.title ??
        "Mission reçue et structurée par Pierre.";

      pushThread({
        id: crypto.randomUUID(),
        role: "assistant",
        content: String(summary),
        createdAt: new Date().toISOString(),
      });

      setEmployeeDraft("");
      setMainSection("followup");
    } finally {
      setBusyAction(null);
    }
  }, [employeeDraft, missionCenter, pushThread]);

  const handleQuickMission = React.useCallback((text: string) => {
    setMainSection("missions");
    setStudioMode("employee");
    setEmployeeDraft(text);
    setTopMenuOpen(false);
    setCommandOpen(false);
  }, []);

  const handleGenerateDocument = React.useCallback(async () => {
    if (!documentComposer.instructions.trim()) return;

    setBusyAction("generate-document");

    try {
      const document = await missionCenter.generateDirectDocument({
        title: documentComposer.title,
        instructions: documentComposer.instructions,
        context: documentComposer.context,
        tone: documentComposer.tone,
        language: documentComposer.language,
      });

      if (document) {
        setDirectDocuments((prev) => [document, ...prev.filter((item) => item.id !== document.id)]);
        setSelectedDocumentId(document.id);
        setArtifactTab("documents");
        setMainSection("artifacts");
      }
    } finally {
      setBusyAction(null);
    }
  }, [documentComposer, missionCenter]);

  const handleDraftEmail = React.useCallback(async () => {
    if (!emailComposer.subject.trim() || !emailComposer.body.trim() || !emailComposer.to.trim()) {
      return;
    }

    setBusyAction("draft-email");

    try {
      const email = await missionCenter.draftDirectEmail({
        to: splitEmails(emailComposer.to),
        cc: splitEmails(emailComposer.cc),
        bcc: splitEmails(emailComposer.bcc),
        subject: emailComposer.subject,
        body: emailComposer.body,
        senderName: memory.senderIdentityResolved.senderName ?? undefined,
        senderEmail: memory.senderIdentityResolved.senderEmail ?? undefined,
        replyTo: memory.senderIdentityResolved.replyTo ?? undefined,
      });

      if (email) {
        setDirectEmails((prev) => [email, ...prev.filter((item) => item.id !== email.id)]);
        setSelectedEmailId(email.id);
        setArtifactTab("emails");
        setMainSection("artifacts");
      }
    } finally {
      setBusyAction(null);
    }
  }, [emailComposer, memory.senderIdentityResolved, missionCenter]);

  const handleSendEmail = React.useCallback(async () => {
    if (!emailComposer.subject.trim() || !emailComposer.body.trim() || !emailComposer.to.trim()) {
      return;
    }

    setBusyAction("send-email");

    try {
      const email = await missionCenter.sendDirectEmail({
        to: splitEmails(emailComposer.to),
        cc: splitEmails(emailComposer.cc),
        bcc: splitEmails(emailComposer.bcc),
        subject: emailComposer.subject,
        body: emailComposer.body,
        senderName: memory.senderIdentityResolved.senderName ?? undefined,
        senderEmail: memory.senderIdentityResolved.senderEmail ?? undefined,
        replyTo: memory.senderIdentityResolved.replyTo ?? undefined,
      });

      if (email) {
        setDirectEmails((prev) => [email, ...prev.filter((item) => item.id !== email.id)]);
        setSelectedEmailId(email.id);
        setArtifactTab("emails");
        setMainSection("artifacts");
      }
    } finally {
      setBusyAction(null);
    }
  }, [emailComposer, memory.senderIdentityResolved, missionCenter]);

  const handleGeneratePdf = React.useCallback(async () => {
    if (!pdfComposer.text.trim()) return;

    setBusyAction("generate-pdf");

    try {
      const pdf = await missionCenter.generateDirectPdf({
        title: pdfComposer.title,
        text: pdfComposer.text,
      });

      if (pdf) {
        const enriched = {
          title: pdfComposer.title || "PDF Pierre",
          text: pdfComposer.text,
          ...pdf,
          created_at: new Date().toISOString(),
        };
        setDirectPdfs((prev) => [enriched, ...prev]);
        setSelectedPdfId(String(enriched.id));
        setArtifactTab("pdfs");
        setMainSection("artifacts");
      }
    } finally {
      setBusyAction(null);
    }
  }, [missionCenter, pdfComposer]);

  const sideItems = [
    { key: "cockpit" as const, label: "Cockpit", icon: LayoutDashboard, hint: "Vue globale" },
    { key: "missions" as const, label: "Missions", icon: Brain, hint: "Commandement" },
    { key: "studios" as const, label: "Studios", icon: Wand2, hint: "Email / Doc / PDF" },
    { key: "followup" as const, label: "Suivi", icon: Workflow, hint: "Tâches / timeline" },
    { key: "artifacts" as const, label: "Artefacts", icon: Archive, hint: "Documents / emails" },
    { key: "history" as const, label: "Historique", icon: History, hint: "Trace complète" },
    { key: "memory" as const, label: "Mémoire", icon: Settings2, hint: "Entreprise / identité" },
  ];

  const quickMissionCards = [
    {
      title: "Préparer une convocation",
      text: "Prépare une convocation à entretien pour demain matin, ton professionnel, puis attends ma validation avant envoi.",
    },
    {
      title: "Relancer un candidat",
      text: "Relance le candidat pour savoir s’il confirme sa disponibilité cette semaine, ton humain et professionnel.",
    },
    {
      title: "Organiser ma journée RH",
      text: "Organise ma journée RH, priorise les urgences, liste les tâches, et propose un plan d’exécution clair.",
    },
    {
      title: "Créer plusieurs actions",
      text: "Prépare 3 convocations, puis un email interne récapitulatif, puis attends ma validation avant tout envoi.",
    },
    {
      title: "Préparer un refus candidat",
      text: "Rédige un mail de refus candidat poli, humain, professionnel, avec ouverture pour opportunités futures.",
    },
    {
      title: "Préparer onboarding",
      text: "Prépare un message d’accueil onboarding pour un nouveau collaborateur avec ton chaleureux et structuré.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6efe6] text-[#2a2118]">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "border-r border-[#eadfce] bg-[#fbf5ee] transition-all duration-300",
            leftCollapsed ? "w-[92px]" : "w-[290px]"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-[#eadfce] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className={cn("min-w-0", leftCollapsed && "hidden")}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a856f]">
                    CloneStore
                  </p>
                  <h1 className="mt-1 text-xl font-semibold text-[#21180f]">Pierre</h1>
                </div>

                <button
                  type="button"
                  onClick={() => setLeftCollapsed((prev) => !prev)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e7dac8] bg-white text-[#6a5845]"
                >
                  <PanelLeft className="h-4.5 w-4.5" />
                </button>
              </div>

              {!leftCollapsed && (
                <div className="mt-4 rounded-[22px] border border-[#eadfce] bg-white px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3e4d0] text-[#5c452c]">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#2a2017]">Assistant RH Automatisé</p>
                      <p className="mt-1 text-xs leading-5 text-[#7b6956]">
                        Centre de missions, exécution, suivi, mémoire et artefacts.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto px-3 py-4">
              <nav className="space-y-2">
                {sideItems.map((item) => {
                  const Icon = item.icon;
                  const active = mainSection === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMainSection(item.key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[20px] border px-3 py-3 text-left transition",
                        active
                          ? "border-[#d9c1a4] bg-[#fff2e3] text-[#4f3c27]"
                          : "border-transparent bg-transparent text-[#685848] hover:border-[#eadfce] hover:bg-[#fffaf3]"
                      )}
                    >
                      <div
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-2xl",
                          active ? "bg-[#f0dcc2]" : "bg-[#f5ede4]"
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>

                      {!leftCollapsed && (
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="mt-0.5 text-xs text-[#857362]">{item.hint}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </nav>

              {!leftCollapsed && (
                <div className="mt-6 rounded-[24px] border border-[#eadfce] bg-[#fffdf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a856f]">
                    état rapide
                  </p>
                  <div className="mt-3 space-y-3 text-sm text-[#5e5143]">
                    <div className="flex items-center justify-between">
                      <span>Mission active</span>
                      <span className="font-semibold text-[#2c231a]">
                        {missionCenter.mission ? "Oui" : "Non"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tâches</span>
                      <span className="font-semibold text-[#2c231a]">
                        {activeMissionTasks.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Artefacts</span>
                      <span className="font-semibold text-[#2c231a]">{missionArtifactsCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Mémoire</span>
                      <span className="font-semibold text-[#2c231a]">
                        {memory.memory ? "OK" : "À faire"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-[1880px] flex-col gap-6 px-5 pb-10 pt-5 lg:px-8">
            <header className={cn(shellPanel(), "px-5 py-4 lg:px-6")}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#e8dccf] bg-white px-3 py-1.5 text-xs font-medium text-[#6d5a48]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Cockpit premium Pierre
                  </div>

                  <div className="mt-3">
                    <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[#20170f]">
                      {mainSection === "cockpit" && "Cockpit global"}
                      {mainSection === "missions" && "Centre de missions"}
                      {mainSection === "studios" && "Studios directs"}
                      {mainSection === "followup" && "Suivi d’exécution"}
                      {mainSection === "artifacts" && "Artefacts produits"}
                      {mainSection === "history" && "Historique complet"}
                      {mainSection === "memory" && "Mémoire entreprise"}
                    </h2>
                    <p className="mt-2 max-w-4xl text-sm leading-7 text-[#665648]">
                      {mainSection === "cockpit" &&
                        "Vue d’ensemble de Pierre : mission active, exécution, artefacts, mémoire et accès direct aux actions clés."}
                      {mainSection === "missions" &&
                        "Donne à Pierre une mission libre comme à un employé en télétravail : il structure, planifie, demande validation si nécessaire, détecte les infos manquantes et prépare l’exécution."}
                      {mainSection === "studios" &&
                        "Production directe sans passer par une mission libre : email, document RH ou PDF."}
                      {mainSection === "followup" &&
                        "Pilotage opérationnel des tâches, validations, blocages, timeline et logs de mission."}
                      {mainSection === "artifacts" &&
                        "Visualise les documents, emails et PDFs générés par Pierre, qu’ils viennent des missions ou des studios directs."}
                      {mainSection === "history" &&
                        "Retrouve les productions passées, navigue dans la continuité, relis l’activité et rouvre les éléments utiles."}
                      {mainSection === "memory" &&
                        "Configure la mémoire entreprise, l’identité d’envoi, le ton et les règles internes utilisées par Pierre."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {voiceSupported && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfce] bg-white px-3 py-2 text-sm text-[#6f5e4f]">
                      {isListening ? (
                        <>
                          <Mic className="h-4 w-4 text-[#9b493c]" />
                          Dictée active
                        </>
                      ) : (
                        <>
                          <MicOff className="h-4 w-4" />
                          Voix prête
                        </>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setCommandOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e7dac8] bg-white px-4 py-2.5 text-sm font-medium text-[#4f3f32]"
                  >
                    <Search className="h-4 w-4" />
                    Rechercher / naviguer
                  </button>

                  <button
                    type="button"
                    onClick={handleRefreshAll}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e7dac8] bg-white px-4 py-2.5 text-sm font-medium text-[#4f3f32]"
                  >
                    {busyAction === "refresh" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Actualiser
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTopMenuOpen((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-full bg-[#2a2118] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      <Menu className="h-4 w-4" />
                      Menu Pierre
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {topMenuOpen && (
                      <div className="absolute right-0 z-30 mt-3 w-[380px] rounded-[24px] border border-[#eadfce] bg-[#fffdf9] p-3 shadow-[0_18px_60px_rgba(84,67,49,0.18)]">
                        <div className="grid gap-2">
                          <MenuAction
                            title="Nouvelle mission libre"
                            description="Ouvre le centre de missions"
                            onClick={() => {
                              setMainSection("missions");
                              setStudioMode("employee");
                              setTopMenuOpen(false);
                            }}
                          />
                          <MenuAction
                            title="Studio email"
                            description="Rédiger / brouillon / envoi"
                            onClick={() => {
                              setMainSection("studios");
                              setStudioMode("email");
                              setTopMenuOpen(false);
                            }}
                          />
                          <MenuAction
                            title="Studio document"
                            description="Document RH direct"
                            onClick={() => {
                              setMainSection("studios");
                              setStudioMode("document");
                              setTopMenuOpen(false);
                            }}
                          />
                          <MenuAction
                            title="Studio PDF"
                            description="Production PDF immédiate"
                            onClick={() => {
                              setMainSection("studios");
                              setStudioMode("pdf");
                              setTopMenuOpen(false);
                            }}
                          />
                          <MenuAction
                            title="Suivi des tâches"
                            description="Validation, blocages, exécution"
                            onClick={() => {
                              setMainSection("followup");
                              setTopMenuOpen(false);
                            }}
                          />
                          <MenuAction
                            title="Artefacts produits"
                            description="Documents, emails, PDFs"
                            onClick={() => {
                              setMainSection("artifacts");
                              setTopMenuOpen(false);
                            }}
                          />
                          <MenuAction
                            title="Historique"
                            description="Recherche et continuité"
                            onClick={() => {
                              setMainSection("history");
                              setTopMenuOpen(false);
                            }}
                          />
                          <MenuAction
                            title="Mémoire entreprise"
                            description="Identité, ton, règles, configuration"
                            onClick={() => {
                              setMainSection("memory");
                              setTopMenuOpen(false);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {(missionCenter.error || history.error || memory.error || voiceError) && (
              <section className="rounded-[24px] border border-[#e9c9c3] bg-[#fff4f2] px-5 py-4 text-[#7b342c] shadow-[0_10px_35px_rgba(123,52,44,0.08)]">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
                  <div className="space-y-1 text-sm">
                    {missionCenter.error && <p>{String((missionCenter.error as any)?.message ?? missionCenter.error)}</p>}
                    {history.error && <p>{history.error}</p>}
                    {memory.error && <p>{String((memory.error as any)?.message ?? memory.error)}</p>}
                    {voiceError && <p>{voiceError}</p>}
                  </div>
                </div>
              </section>
            )}

            {mainSection === "cockpit" && (
              <div className="grid gap-6 xl:grid-cols-[1.24fr_0.76fr]">
                <section className={cn(shellPanel(), "p-5 lg:p-6")}>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      icon={Brain}
                      label="Mission active"
                      value={missionCenter.mission ? "Oui" : "Non"}
                      hint={missionCenter.mission?.title ?? "Aucune mission"}
                      tone={missionCenter.mission ? "good" : "neutral"}
                    />
                    <KpiCard
                      icon={Clock3}
                      label="Tâches actives"
                      value={String(queuedCount + runningCount + awaitingInfoCount + approvalCount)}
                      hint={`${queuedCount} prêtes · ${runningCount} en cours`}
                    />
                    <KpiCard
                      icon={Archive}
                      label="Artefacts"
                      value={String(missionArtifactsCount)}
                      hint={`${mergedDocuments.length} docs · ${mergedEmails.length} emails · ${directPdfs.length} pdf`}
                    />
                    <KpiCard
                      icon={Shield}
                      label="Mémoire"
                      value={memory.memory ? "Configurée" : "À compléter"}
                      hint={memory.senderIdentityResolved.senderEmail ?? "Identité d’envoi non définie"}
                      tone={memory.memory ? "good" : "warn"}
                    />
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
                    <div className={cn(softPanel(), "p-4")}>
                      <p className="text-sm font-semibold text-[#2f2418]">Mission en avant</p>
                      <div className="mt-4 rounded-[22px] border border-[#eadfce] bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-[#221910]">
                              {missionCenter.mission?.title ?? "Aucune mission focalisée"}
                            </p>
                            <p className="mt-1 text-sm text-[#7b6956]">
                              {String(missionCenter.interpretation?.summary ?? missionCenter.mission?.request_text ?? "Sélectionne ou crée une mission pour afficher son contexte.")}
                            </p>
                          </div>
                          <StatusBadgeAny
                            status={missionCenter.mission?.status ?? "idle"}
                            riskLevel={missionCenter.mission?.risk_level ?? "normal"}
                          />
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <MiniState label="Prêtes" value={String(queuedCount)} />
                          <MiniState label="En cours" value={String(runningCount)} />
                          <MiniState label="Validation" value={String(approvalCount)} />
                          <MiniState label="Infos" value={String(awaitingInfoCount)} />
                          <MiniState label="Terminées" value={String(completedCount)} />
                          <MiniState label="Bloquées" value={String(blockedCount)} />
                        </div>
                      </div>
                    </div>

                    <div className={cn(softPanel(), "p-4")}>
                      <p className="text-sm font-semibold text-[#2f2418]">Actions rapides</p>
                      <div className="mt-4 grid gap-3">
                        <QuickActionButton
                          icon={Brain}
                          title="Créer une nouvelle mission"
                          description="Basculer vers le centre de missions"
                          onClick={() => setMainSection("missions")}
                        />
                        <QuickActionButton
                          icon={Mail}
                          title="Créer un email direct"
                          description="Ouvrir le studio email"
                          onClick={() => {
                            setMainSection("studios");
                            setStudioMode("email");
                          }}
                        />
                        <QuickActionButton
                          icon={FileText}
                          title="Créer un document RH"
                          description="Ouvrir le studio document"
                          onClick={() => {
                            setMainSection("studios");
                            setStudioMode("document");
                          }}
                        />
                        <QuickActionButton
                          icon={Workflow}
                          title="Voir le suivi opérationnel"
                          description="Tâches, timeline et validations"
                          onClick={() => setMainSection("followup")}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <div className={cn(shellPanel(), "p-5")}>
                    <p className="text-sm font-semibold text-[#2f2418]">Identité d’envoi active</p>
                    <div className="mt-4 rounded-[22px] border border-[#eadfce] bg-white p-4">
                      <p className="text-sm text-[#4b3e31]">
                        <span className="font-semibold text-[#281e15]">Nom :</span>{" "}
                        {memory.senderIdentityResolved.senderName ?? "Non défini"}
                      </p>
                      <p className="mt-2 text-sm text-[#4b3e31]">
                        <span className="font-semibold text-[#281e15]">Email :</span>{" "}
                        {memory.senderIdentityResolved.senderEmail ?? "Non défini"}
                      </p>
                      <p className="mt-2 text-sm text-[#4b3e31]">
                        <span className="font-semibold text-[#281e15]">Reply-to :</span>{" "}
                        {memory.senderIdentityResolved.replyTo ?? "Non défini"}
                      </p>
                      <p className="mt-2 text-xs text-[#8a7764]">
                        Source : {memory.senderIdentityResolved.source}
                      </p>
                    </div>
                  </div>

                  <div className={cn(shellPanel(), "p-5")}>
                    <p className="text-sm font-semibold text-[#2f2418]">Derniers échanges</p>
                    <div className="mt-4 space-y-3">
                      {threadEntries.length === 0 ? (
                        <EmptyState
                          icon={ScrollText}
                          title="Aucun échange"
                          description="Les derniers briefs et réponses Pierre apparaîtront ici."
                        />
                      ) : (
                        threadEntries.slice(0, 4).map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-[18px] border border-[#eadfce] bg-white px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98836f]">
                                {entry.role === "user"
                                  ? "vous"
                                  : entry.role === "assistant"
                                  ? "pierre"
                                  : "système"}
                              </span>
                              <span className="text-xs text-[#998672]">
                                {formatDateTime(entry.createdAt)}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#372c22]">
                              {entry.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {mainSection === "missions" && (
              <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
                <section className={cn(shellPanel(), "p-5 lg:p-6")}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a856f]">
                        commandement
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-[#221910]">
                        Donne une mission à Pierre
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-[#665648]">
                        Parle à Pierre comme à un employé : il comprend la demande,
                        détecte les actions multiples, identifie les informations manquantes,
                        évalue le risque, propose les validations utiles et structure la mission.
                      </p>
                    </div>

                    {voiceSupported && (
                      <button
                        type="button"
                        onClick={() => startVoice("employeeDraft")}
                        className="inline-flex items-center gap-2 rounded-full border border-[#e7dac8] bg-white px-4 py-2 text-sm font-medium text-[#5c4d40]"
                      >
                        <Mic className="h-4 w-4" />
                        Dictée mission
                      </button>
                    )}
                  </div>

                  <div className="mt-6 rounded-[24px] border border-[#eadfce] bg-white p-4">
                    <MissionComposerAny
                      value={employeeDraft}
                      onChange={setEmployeeDraft}
                      onSubmit={handleSubmitMission}
                      loading={busyAction === "submit-mission" || missionCenter.submitting}
                      placeholder="Exemple : prépare 3 convocations pour demain, relance le candidat si pas de réponse ce soir, puis attends ma validation avant tout envoi."
                    />

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSubmitMission}
                        disabled={
                          !employeeDraft.trim() ||
                          busyAction === "submit-mission" ||
                          missionCenter.submitting
                        }
                        className="inline-flex items-center gap-2 rounded-full bg-[#2a2118] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d160f] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyAction === "submit-mission" || missionCenter.submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Lancer la mission
                      </button>

                      {isListening && voiceTarget === "employeeDraft" && (
                        <button
                          type="button"
                          onClick={stopVoice}
                          className="inline-flex items-center gap-2 rounded-full border border-[#e5c2be] bg-[#fff1ef] px-3 py-2 text-sm font-medium text-[#8b3d33]"
                        >
                          <MicOff className="h-4 w-4" />
                          Arrêter la dictée
                        </button>
                      )}
                    </div>

                    {voiceInterim && voiceTarget === "employeeDraft" && (
                      <p className="mt-3 text-sm italic text-[#8a7763]">{voiceInterim}</p>
                    )}
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {quickMissionCards.map((card) => (
                      <QuickMissionCard
                        key={card.title}
                        title={card.title}
                        text={card.text}
                        onClick={() => handleQuickMission(card.text)}
                      />
                    ))}
                  </div>
                </section>

                <section className="space-y-6">
                  <div className={cn(shellPanel(), "p-5")}>
                    <p className="text-sm font-semibold text-[#2f2418]">Mission comprise</p>
                    <div className="mt-4">
                      <MissionUnderstandingAny
                        mission={missionCenter.mission}
                        interpretation={missionCenter.interpretation}
                        tasks={missionCenter.tasks}
                      />
                    </div>
                  </div>

                  <div className={cn(shellPanel(), "p-5")}>
                    <p className="text-sm font-semibold text-[#2f2418]">Fil mission</p>
                    <div className="mt-4 space-y-3">
                      {threadEntries.length === 0 ? (
                        <EmptyState
                          icon={ScrollText}
                          title="Aucun brief enregistré"
                          description="Les échanges liés aux missions apparaîtront ici."
                        />
                      ) : (
                        threadEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className={cn(
                              "rounded-[20px] border px-4 py-3",
                              entry.role === "user"
                                ? "border-[#eadfce] bg-[#fcf7f0]"
                                : "border-[#e3d6c8] bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#917e6a]">
                                {entry.role === "user"
                                  ? "vous"
                                  : entry.role === "assistant"
                                  ? "pierre"
                                  : "système"}
                              </span>
                              <span className="text-xs text-[#9b8975]">
                                {formatDateTime(entry.createdAt)}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#33281d]">
                              {entry.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {mainSection === "studios" && (
              <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
                <section className={cn(shellPanel(), "p-5")}>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <StudioSwitcher
                      active={studioMode === "employee"}
                      icon={Bot}
                      title="Mission libre"
                      description="Retour au centre de missions"
                      onClick={() => {
                        setMainSection("missions");
                        setStudioMode("employee");
                      }}
                    />
                    <StudioSwitcher
                      active={studioMode === "email"}
                      icon={Mail}
                      title="Studio email"
                      description="Brouillon ou préparation d’envoi"
                      onClick={() => setStudioMode("email")}
                    />
                    <StudioSwitcher
                      active={studioMode === "document"}
                      icon={FileText}
                      title="Studio document"
                      description="Production RH premium"
                      onClick={() => setStudioMode("document")}
                    />
                    <StudioSwitcher
                      active={studioMode === "pdf"}
                      icon={FileType2}
                      title="Studio PDF"
                      description="Génération directe"
                      onClick={() => setStudioMode("pdf")}
                    />
                  </div>
                </section>

                <section className={cn(shellPanel(), "p-5 lg:p-6")}>
                  {studioMode === "email" && (
                    <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
                      <div className="space-y-4">
                        <Field label="À">
                          <textarea
                            value={emailComposer.to}
                            onChange={(e) =>
                              setEmailComposer((prev) => ({ ...prev, to: e.target.value }))
                            }
                            rows={2}
                            className={fieldClass}
                            placeholder="prenom@entreprise.fr, candidat@gmail.com"
                          />
                        </Field>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Cc">
                            <input
                              value={emailComposer.cc}
                              onChange={(e) =>
                                setEmailComposer((prev) => ({ ...prev, cc: e.target.value }))
                              }
                              className={fieldClass}
                              placeholder="optionnel"
                            />
                          </Field>
                          <Field label="Bcc">
                            <input
                              value={emailComposer.bcc}
                              onChange={(e) =>
                                setEmailComposer((prev) => ({ ...prev, bcc: e.target.value }))
                              }
                              className={fieldClass}
                              placeholder="optionnel"
                            />
                          </Field>
                        </div>

                        <Field
                          label="Objet"
                          action={
                            voiceSupported ? <VoiceButton onClick={() => startVoice("emailSubject")} /> : null
                          }
                        >
                          <input
                            value={emailComposer.subject}
                            onChange={(e) =>
                              setEmailComposer((prev) => ({ ...prev, subject: e.target.value }))
                            }
                            className={fieldClass}
                            placeholder="Objet du message"
                          />
                        </Field>

                        <Field
                          label="Corps du message"
                          action={
                            voiceSupported ? <VoiceButton onClick={() => startVoice("emailBody")} /> : null
                          }
                        >
                          <textarea
                            value={emailComposer.body}
                            onChange={(e) =>
                              setEmailComposer((prev) => ({ ...prev, body: e.target.value }))
                            }
                            rows={14}
                            className={fieldClass}
                            placeholder="Rédige ici le message ou colle une base à améliorer."
                          />
                        </Field>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleDraftEmail}
                            disabled={busyAction === "draft-email"}
                            className="inline-flex items-center gap-2 rounded-full border border-[#e5d7c7] bg-white px-4 py-2.5 text-sm font-semibold text-[#4c4033] transition hover:bg-[#fffaf3] disabled:opacity-50"
                          >
                            {busyAction === "draft-email" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4" />
                            )}
                            Créer le brouillon
                          </button>

                          <button
                            type="button"
                            onClick={handleSendEmail}
                            disabled={busyAction === "send-email"}
                            className="inline-flex items-center gap-2 rounded-full bg-[#2a2118] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d160f] disabled:opacity-50"
                          >
                            {busyAction === "send-email" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Préparer l’envoi
                          </button>
                        </div>

                        {voiceInterim &&
                          (voiceTarget === "emailSubject" || voiceTarget === "emailBody") && (
                            <p className="text-sm italic text-[#8a7763]">{voiceInterim}</p>
                          )}
                      </div>

                      <div className={cn(softPanel(), "p-4")}>
                        <p className="text-sm font-semibold text-[#2f2418]">Prévisualisation</p>
                        <div className="mt-4 rounded-[22px] border border-[#eadfce] bg-white p-5">
                          <p className="text-xs uppercase tracking-[0.18em] text-[#99856f]">de</p>
                          <p className="mt-1 text-sm text-[#3a2e22]">
                            {memory.senderIdentityResolved.senderName ?? "Nom d’envoi"}{" "}
                            {memory.senderIdentityResolved.senderEmail
                              ? `<${memory.senderIdentityResolved.senderEmail}>`
                              : ""}
                          </p>

                          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#99856f]">à</p>
                          <p className="mt-1 text-sm text-[#3a2e22]">
                            {emailComposer.to || "Destinataire(s)"}
                          </p>

                          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#99856f]">
                            objet
                          </p>
                          <p className="mt-1 text-base font-semibold text-[#21180f]">
                            {emailComposer.subject || "Objet du message"}
                          </p>

                          <div className="mt-5 border-t border-[#eee4d8] pt-5">
                            <p className="whitespace-pre-wrap text-sm leading-7 text-[#3f3326]">
                              {emailComposer.body || "Le contenu du message apparaîtra ici."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {studioMode === "document" && (
                    <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
                      <div className="space-y-4">
                        <Field label="Titre (optionnel)">
                          <input
                            value={documentComposer.title}
                            onChange={(e) =>
                              setDocumentComposer((prev) => ({ ...prev, title: e.target.value }))
                            }
                            className={fieldClass}
                            placeholder="Exemple : Convocation entretien commercial"
                          />
                        </Field>

                        <Field
                          label="Instructions"
                          action={
                            voiceSupported ? (
                              <VoiceButton onClick={() => startVoice("documentInstructions")} />
                            ) : null
                          }
                        >
                          <textarea
                            value={documentComposer.instructions}
                            onChange={(e) =>
                              setDocumentComposer((prev) => ({
                                ...prev,
                                instructions: e.target.value,
                              }))
                            }
                            rows={7}
                            className={fieldClass}
                            placeholder="Explique précisément ce que Pierre doit produire."
                          />
                        </Field>

                        <Field
                          label="Contexte"
                          action={
                            voiceSupported ? (
                              <VoiceButton onClick={() => startVoice("documentContext")} />
                            ) : null
                          }
                        >
                          <textarea
                            value={documentComposer.context}
                            onChange={(e) =>
                              setDocumentComposer((prev) => ({
                                ...prev,
                                context: e.target.value,
                              }))
                            }
                            rows={7}
                            className={fieldClass}
                            placeholder="Contexte entreprise, ton, infos utiles, contraintes."
                          />
                        </Field>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Ton">
                            <input
                              value={documentComposer.tone}
                              onChange={(e) =>
                                setDocumentComposer((prev) => ({
                                  ...prev,
                                  tone: e.target.value,
                                }))
                              }
                              className={fieldClass}
                              placeholder="professionnel"
                            />
                          </Field>
                          <Field label="Langue">
                            <input
                              value={documentComposer.language}
                              onChange={(e) =>
                                setDocumentComposer((prev) => ({
                                  ...prev,
                                  language: e.target.value,
                                }))
                              }
                              className={fieldClass}
                              placeholder="fr"
                            />
                          </Field>
                        </div>

                        <button
                          type="button"
                          onClick={handleGenerateDocument}
                          disabled={busyAction === "generate-document"}
                          className="inline-flex w-fit items-center gap-2 rounded-full bg-[#2a2118] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d160f] disabled:opacity-50"
                        >
                          {busyAction === "generate-document" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                          Générer le document
                        </button>

                        {voiceInterim &&
                          (voiceTarget === "documentInstructions" ||
                            voiceTarget === "documentContext") && (
                            <p className="text-sm italic text-[#8a7763]">{voiceInterim}</p>
                          )}
                      </div>

                      <div className={cn(softPanel(), "p-4")}>
                        <p className="text-sm font-semibold text-[#2f2418]">Aperçu</p>
                        <div className="mt-4 rounded-[22px] border border-[#eadfce] bg-white p-5">
                          <p className="text-lg font-semibold text-[#221910]">
                            {documentComposer.title || "Titre du document"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-[#e8dac7] bg-[#fcf7f0] px-2.5 py-1 text-[#715f4d]">
                              Ton : {documentComposer.tone || "—"}
                            </span>
                            <span className="rounded-full border border-[#e8dac7] bg-[#fcf7f0] px-2.5 py-1 text-[#715f4d]">
                              Langue : {documentComposer.language || "—"}
                            </span>
                          </div>
                          <div className="mt-5 space-y-4 text-sm leading-7 text-[#3a2f24]">
                            <div>
                              <p className="font-medium text-[#251b12]">Instructions</p>
                              <p className="mt-1 whitespace-pre-wrap text-[#5c5044]">
                                {documentComposer.instructions || "Les instructions apparaîtront ici."}
                              </p>
                            </div>
                            <div>
                              <p className="font-medium text-[#251b12]">Contexte</p>
                              <p className="mt-1 whitespace-pre-wrap text-[#5c5044]">
                                {documentComposer.context || "Le contexte apparaîtra ici."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {studioMode === "pdf" && (
                    <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
                      <div className="space-y-4">
                        <Field label="Titre">
                          <input
                            value={pdfComposer.title}
                            onChange={(e) =>
                              setPdfComposer((prev) => ({ ...prev, title: e.target.value }))
                            }
                            className={fieldClass}
                            placeholder="Titre du PDF"
                          />
                        </Field>

                        <Field
                          label="Texte / contenu"
                          action={
                            voiceSupported ? <VoiceButton onClick={() => startVoice("pdfText")} /> : null
                          }
                        >
                          <textarea
                            value={pdfComposer.text}
                            onChange={(e) =>
                              setPdfComposer((prev) => ({ ...prev, text: e.target.value }))
                            }
                            rows={16}
                            className={fieldClass}
                            placeholder="Texte à convertir en PDF."
                          />
                        </Field>

                        <button
                          type="button"
                          onClick={handleGeneratePdf}
                          disabled={busyAction === "generate-pdf"}
                          className="inline-flex w-fit items-center gap-2 rounded-full bg-[#2a2118] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d160f] disabled:opacity-50"
                        >
                          {busyAction === "generate-pdf" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ScrollText className="h-4 w-4" />
                          )}
                          Générer le PDF
                        </button>

                        {voiceInterim && voiceTarget === "pdfText" && (
                          <p className="text-sm italic text-[#8a7763]">{voiceInterim}</p>
                        )}
                      </div>

                      <div className={cn(softPanel(), "p-4")}>
                        <p className="text-sm font-semibold text-[#2f2418]">Prévisualisation texte</p>
                        <div className="mt-4 rounded-[22px] border border-[#eadfce] bg-white p-5">
                          <p className="text-lg font-semibold text-[#221910]">
                            {pdfComposer.title || "Titre PDF"}
                          </p>
                          <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#3c3025]">
                            {pdfComposer.text || "Le contenu texte apparaîtra ici."}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {studioMode === "employee" && (
                    <div className={cn(softPanel(), "p-5")}>
                      <p className="text-sm font-semibold text-[#2f2418]">Mission libre</p>
                      <p className="mt-2 text-sm leading-7 text-[#665648]">
                        Le centre de missions a maintenant son propre espace dédié.
                      </p>
                      <button
                        type="button"
                        onClick={() => setMainSection("missions")}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#2a2118] px-4 py-2.5 text-sm font-semibold text-white"
                      >
                        <Brain className="h-4 w-4" />
                        Aller au centre de missions
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}

            {mainSection === "followup" && (
              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <section className="space-y-6">
                  <div className={cn(shellPanel(), "p-5")}>
                    <MissionUnderstandingAny
                      mission={missionCenter.mission}
                      interpretation={missionCenter.interpretation}
                      tasks={missionCenter.tasks}
                    />
                  </div>

                  <div className={cn(shellPanel(), "p-5")}>
                    <ExecutionBoardAny
                      mission={missionCenter.mission}
                      tasks={missionCenter.tasks}
                      logs={missionCenter.logs}
                    />
                  </div>
                </section>

                <section className="space-y-6">
                  <div className={cn(shellPanel(), "p-5")}>
                    <TaskListAny
                      tasks={missionCenter.tasks}
                      onRunTask={missionCenter.runTask}
                      onApproveTask={missionCenter.approveTask}
                      onCancelTask={missionCenter.cancelTask}
                      onRescheduleTask={missionCenter.rescheduleTask}
                      relatedDocumentForTask={(task: PierreTask) =>
                        relatedDocumentForTask(task, mergedDocuments)
                      }
                      relatedEmailForTask={(task: PierreTask) =>
                        relatedEmailForTask(task, mergedEmails)
                      }
                    />
                  </div>

                  <div className={cn(shellPanel(), "p-5")}>
                    <TimelineAny
                      mission={missionCenter.mission}
                      tasks={missionCenter.tasks}
                      logs={missionCenter.logs}
                      documents={mergedDocuments}
                      emails={mergedEmails}
                    />
                  </div>
                </section>
              </div>
            )}

            {mainSection === "artifacts" && (
              <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
                <section className={cn(shellPanel(), "p-5")}>
                  <div className="flex flex-wrap gap-2">
                    <TopTab
                      active={artifactTab === "documents"}
                      onClick={() => setArtifactTab("documents")}
                      icon={FileText}
                      label={`Documents (${mergedDocuments.length})`}
                    />
                    <TopTab
                      active={artifactTab === "emails"}
                      onClick={() => setArtifactTab("emails")}
                      icon={Mail}
                      label={`Emails (${mergedEmails.length})`}
                    />
                    <TopTab
                      active={artifactTab === "pdfs"}
                      onClick={() => setArtifactTab("pdfs")}
                      icon={FileType2}
                      label={`PDFs (${directPdfs.length})`}
                    />
                  </div>

                  <div className="mt-5 max-h-[700px] space-y-3 overflow-auto pr-1">
                    {artifactTab === "documents" &&
                      (mergedDocuments.length === 0 ? (
                        <EmptyState
                          icon={FileText}
                          title="Aucun document"
                          description="Les documents générés apparaîtront ici."
                        />
                      ) : (
                        mergedDocuments.map((doc) => (
                          <ArtifactRow
                            key={doc.id}
                            active={selectedDocumentId === doc.id}
                            title={doc.title ?? "Document sans titre"}
                            subtitle={`${doc.type ?? "document"} · ${formatDateTime(
                              doc.updated_at ?? doc.created_at
                            )}`}
                            status={doc.status ?? "ready"}
                            onClick={() => setSelectedDocumentId(doc.id)}
                          />
                        ))
                      ))}

                    {artifactTab === "emails" &&
                      (mergedEmails.length === 0 ? (
                        <EmptyState
                          icon={Mail}
                          title="Aucun email"
                          description="Les brouillons et préparations d’envoi apparaîtront ici."
                        />
                      ) : (
                        mergedEmails.map((mail) => (
                          <ArtifactRow
                            key={mail.id}
                            active={selectedEmailId === mail.id}
                            title={mail.subject ?? "Email sans objet"}
                            subtitle={`${mail.status ?? "draft"} · ${formatDateTime(
                              mail.updated_at ?? mail.created_at
                            )}`}
                            status={mail.status ?? "draft"}
                            onClick={() => setSelectedEmailId(mail.id)}
                          />
                        ))
                      ))}

                    {artifactTab === "pdfs" &&
                      (directPdfs.length === 0 ? (
                        <EmptyState
                          icon={FileType2}
                          title="Aucun PDF"
                          description="Les PDF générés apparaîtront ici."
                        />
                      ) : (
                        directPdfs.map((pdf) => (
                          <ArtifactRow
                            key={String(pdf.id ?? "")}
                            active={selectedPdfId === String(pdf.id ?? "")}
                            title={String(pdf.title ?? "PDF Pierre")}
                            subtitle={formatDateTime(String(pdf.created_at ?? ""))}
                            status="ready"
                            onClick={() => setSelectedPdfId(String(pdf.id ?? ""))}
                          />
                        ))
                      ))}
                  </div>
                </section>

                <section className={cn(shellPanel(), "p-5")}>
                  {artifactTab === "documents" && (
                    <DocumentPanelAny
                      document={selectedDocument}
                      documents={mergedDocuments}
                      selectedDocumentId={selectedDocumentId}
                      onSelectDocument={setSelectedDocumentId}
                    />
                  )}

                  {artifactTab === "emails" && (
                    <>
                      {selectedEmail ? (
                        <div className="space-y-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-2xl font-semibold text-[#241b12]">
                                {selectedEmail.subject ?? "Email"}
                              </p>
                              <p className="mt-2 text-sm text-[#756555]">
                                {selectedEmail.sender_name ?? "Pierre"}{" "}
                                {selectedEmail.sender_email
                                  ? `<${selectedEmail.sender_email}>`
                                  : ""}
                              </p>
                            </div>
                            <StatusBadgeAny status={selectedEmail.status ?? "draft"} />
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <InfoCard
                              label="À"
                              value={
                                Array.isArray(selectedEmail.to)
                                  ? selectedEmail.to.join(", ")
                                  : (selectedEmail.to as string) ?? "—"
                              }
                            />
                            <InfoCard label="Statut" value={selectedEmail.status ?? "—"} />
                          </div>

                          <div className="rounded-[22px] border border-[#eadfce] bg-white p-5">
                            <p className="whitespace-pre-wrap text-sm leading-7 text-[#3d3025]">
                              {String(selectedEmail.text ?? selectedEmail.html ?? "Contenu indisponible")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          icon={Mail}
                          title="Aucun email sélectionné"
                          description="Sélectionne un email pour l’afficher."
                        />
                      )}
                    </>
                  )}

                  {artifactTab === "pdfs" && (
                    <>
                      {selectedPdf ? (
                        <div className="space-y-5">
                          <p className="text-2xl font-semibold text-[#241b12]">
                            {String(selectedPdf.title ?? "PDF")}
                          </p>
                          <div className="rounded-[22px] border border-[#eadfce] bg-white p-5">
                            <p className="whitespace-pre-wrap text-sm leading-7 text-[#3d3025]">
                              {String(selectedPdf.text ?? selectedPdf.html ?? "Prévisualisation indisponible")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          icon={FileType2}
                          title="Aucun PDF sélectionné"
                          description="Sélectionne un PDF pour l’afficher."
                        />
                      )}
                    </>
                  )}
                </section>
              </div>
            )}

            {mainSection === "history" && (
              <section className={cn(shellPanel(), "p-5 lg:p-6")}>
                <HistoryPanelAny
                  items={history.items}
                  loading={history.loading}
                  onRefresh={() => history.refresh({ includeTasks: true })}
                  onLoadMore={history.loadMore}
                  onSelectMission={(missionId: string) => {
                    missionCenter.setFocusedMissionId(missionId);
                    setMainSection("followup");
                  }}
                />
              </section>
            )}

            {mainSection === "memory" && (
              <section className={cn(shellPanel(), "p-5 lg:p-6")}>
                <MemoryPanelAny
                  memory={memory.memory}
                  loading={memory.loading}
                  saving={memory.saving}
                  onRefresh={memory.refresh}
                  onSave={memory.updateMemory}
                  senderIdentityResolved={memory.senderIdentityResolved}
                />
              </section>
            )}
          </div>
        </main>
      </div>

      {commandOpen && (
        <div className="fixed inset-0 z-50 bg-[rgba(31,24,15,0.38)] px-4 py-10 backdrop-blur-[3px]">
          <div className="mx-auto w-full max-w-[920px] rounded-[30px] border border-[#eadfce] bg-[#fffdf9] shadow-[0_28px_90px_rgba(64,50,35,0.24)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#eadfce] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a856f]">
                  navigation rapide
                </p>
                <p className="mt-1 text-lg font-semibold text-[#241b12]">
                  Rechercher une mission, une vue ou un historique
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e7dac8] bg-white text-[#5e4f42]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="px-5 py-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a856f]" />
                <input
                  value={commandSearch}
                  onChange={(e) => setCommandSearch(e.target.value)}
                  placeholder="Rechercher : convocation, historique, email, mémoire..."
                  className="w-full rounded-[20px] border border-[#e7dac8] bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#a28d78] focus:border-[#d8bd9d] focus:ring-4 focus:ring-[#f3e6d6]"
                />
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="space-y-3">
                  <CommandBlock title="Aller vers">
                    <CommandRow label="Cockpit global" onClick={() => jumpSection(setCommandOpen, setMainSection, "cockpit")} />
                    <CommandRow label="Centre de missions" onClick={() => jumpSection(setCommandOpen, setMainSection, "missions")} />
                    <CommandRow label="Studios directs" onClick={() => jumpSection(setCommandOpen, setMainSection, "studios")} />
                    <CommandRow label="Suivi d’exécution" onClick={() => jumpSection(setCommandOpen, setMainSection, "followup")} />
                    <CommandRow label="Artefacts produits" onClick={() => jumpSection(setCommandOpen, setMainSection, "artifacts")} />
                    <CommandRow label="Historique" onClick={() => jumpSection(setCommandOpen, setMainSection, "history")} />
                    <CommandRow label="Mémoire entreprise" onClick={() => jumpSection(setCommandOpen, setMainSection, "memory")} />
                  </CommandBlock>

                  <CommandBlock title="Actions rapides">
                    <CommandRow
                      label="Nouveau mail direct"
                      onClick={() => {
                        setMainSection("studios");
                        setStudioMode("email");
                        setCommandOpen(false);
                      }}
                    />
                    <CommandRow
                      label="Nouveau document direct"
                      onClick={() => {
                        setMainSection("studios");
                        setStudioMode("document");
                        setCommandOpen(false);
                      }}
                    />
                    <CommandRow
                      label="Nouveau PDF direct"
                      onClick={() => {
                        setMainSection("studios");
                        setStudioMode("pdf");
                        setCommandOpen(false);
                      }}
                    />
                    <CommandRow
                      label="Actualiser tout"
                      onClick={() => {
                        setCommandOpen(false);
                        void handleRefreshAll();
                      }}
                    />
                  </CommandBlock>
                </div>

                <div className="space-y-3">
                  <CommandBlock title="Historique récent">
                    {filteredHistory.length === 0 ? (
                      <p className="text-sm text-[#7d6b59]">Aucun résultat.</p>
                    ) : (
                      filteredHistory.map((item: any) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.mission_id) {
                              missionCenter.setFocusedMissionId(item.mission_id);
                              setMainSection("followup");
                            } else {
                              setMainSection("history");
                            }
                            setCommandOpen(false);
                          }}
                          className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-[#eadfce] bg-white px-4 py-3 text-left transition hover:bg-[#fffaf3]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#2b2118]">
                              {item.title ?? "Élément"}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#84715e]">
                              {item.subtitle ?? item.kind ?? "historique"}
                            </p>
                          </div>
                          <span className="flex-none rounded-full border border-[#eadbc9] bg-[#fcf7f0] px-2.5 py-1 text-[11px] font-medium text-[#735f4b]">
                            {item.status ?? "—"}
                          </span>
                        </button>
                      ))
                    )}
                  </CommandBlock>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function jumpSection(
  close: React.Dispatch<React.SetStateAction<boolean>>,
  setSection: React.Dispatch<React.SetStateAction<MainSection>>,
  section: MainSection
) {
  setSection(section);
  close(false);
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div className="rounded-[22px] border border-[#eadfce] bg-[#fffdf9] p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-2xl",
            tone === "good" && "bg-[#e7f4eb] text-[#2f6c43]",
            tone === "warn" && "bg-[#fff1df] text-[#8a5b17]",
            tone === "neutral" && "bg-[#f5ede4] text-[#745f48]"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b8771]">
            {label}
          </p>
          <p className="mt-1 text-lg font-semibold text-[#241b12]">{value}</p>
          {hint ? <p className="mt-1 truncate text-xs text-[#83715f]">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

function MiniState({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#eadfce] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a856f]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#241b12]">{value}</p>
    </div>
  );
}

function QuickActionButton({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-[20px] border border-[#eadfce] bg-white px-4 py-4 text-left transition hover:bg-[#fffaf3]"
    >
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#2b2118]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#7b6956]">{description}</p>
      </div>
    </button>
  );
}

function QuickMissionCard({
  title,
  text,
  onClick,
}: {
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[22px] border border-[#eadfce] bg-[#fffdf8] p-4 text-left transition hover:bg-white"
    >
      <p className="text-sm font-semibold text-[#2d2319]">{title}</p>
      <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#746352]">{text}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#9a856f]">
        Utiliser ce brief
      </p>
    </button>
  );
}

function StudioSwitcher({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-[22px] border px-4 py-4 text-left transition",
        active
          ? "border-[#d9c1a4] bg-[#fff2e3]"
          : "border-[#eadfce] bg-[#fffdf9] hover:bg-white"
      )}
    >
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#2b2118]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#7b6956]">{description}</p>
      </div>
    </button>
  );
}

function MenuAction({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[18px] border border-[#eadfce] bg-white px-4 py-3 text-left transition hover:bg-[#fffaf3]"
    >
      <p className="text-sm font-semibold text-[#2d2319]">{title}</p>
      <p className="mt-1 text-xs text-[#7b6956]">{description}</p>
    </button>
  );
}

function TopTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-[#d9c1a4] bg-[#fff4e6] text-[#5a4427]"
          : "border-[#eadfce] bg-[#fffdf9] text-[#6b5a49] hover:bg-white"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ArtifactRow({
  active,
  title,
  subtitle,
  status,
  onClick,
}: {
  active?: boolean;
  title: string;
  subtitle: string;
  status: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition",
        active
          ? "border-[#d9c1a4] bg-[#fff5e8]"
          : "border-[#eadfce] bg-[#fffdf9] hover:bg-white"
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#2b2118]">{title}</p>
        <p className="mt-1 truncate text-xs text-[#84715e]">{subtitle}</p>
      </div>
      <div className="flex-none">
        <span className="rounded-full border border-[#eadbc9] bg-white px-2.5 py-1 text-[11px] font-medium text-[#735f4b]">
          {status}
        </span>
      </div>
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-[#e6dacb] bg-[#fffdf9] px-4 py-8 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-semibold text-[#2e241a]">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#7a6957]">{description}</p>
    </div>
  );
}

function Field({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#382d22]">{label}</span>
        {action}
      </div>
      {children}
    </label>
  );
}

function VoiceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-[#e7dac8] bg-white px-3 py-1.5 text-xs font-medium text-[#5c4d40]"
    >
      <Mic className="h-3.5 w-3.5" />
      Dictée
    </button>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#eadfce] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a856f]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#2d2319]">{value}</p>
    </div>
  );
}

function CommandBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-[#eadfce] bg-[#fffaf3] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a856f]">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function CommandRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-[#eadfce] bg-white px-4 py-3 text-left text-sm font-medium text-[#2d2319] transition hover:bg-[#fffdf8]"
    >
      <span>{label}</span>
      <ChevronDown className="h-4 w-4 rotate-[-90deg] text-[#8c7966]" />
    </button>
  );
}




