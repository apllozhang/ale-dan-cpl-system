import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { hasPermission, PERMISSIONS } from "@shared/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useRef } from "react";
import {
  Brain, Search, BookOpen, Plus, Trash2, TestTube, Star, Upload, Loader2, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// ── Types ──
type ModelForm = {
  name: string;
  provider: "openai_compatible" | "google_gemini";
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  maxTokens: string;
  temperature: string;
  isDefault: boolean;
};

type SearchConfigForm = {
  name: string;
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  isDefault: boolean;
};

type KnowledgeBaseForm = {
  name: string;
  description: string;
};

const emptyModelForm: ModelForm = {
  name: "",
  provider: "openai_compatible",
  apiBaseUrl: "",
  apiKey: "",
  modelName: "",
  maxTokens: "",
  temperature: "",
  isDefault: false,
};

const emptySearchConfigForm: SearchConfigForm = {
  name: "",
  provider: "serper",
  apiBaseUrl: "https://google.serper.dev/search",
  apiKey: "",
  isDefault: false,
};

const emptyKbForm: KnowledgeBaseForm = {
  name: "",
  description: "",
};

const SEARCH_PROVIDER_DEFAULTS: Record<string, string> = {
  serper: "https://google.serper.dev/search",
  serpapi: "https://serpapi.com/search",
  tavily: "https://api.tavily.com/search",
  custom: "",
};

// ══════════════════════════════════════════
//  ModelsPanel
// ══════════════════════════════════════════
function ModelsPanel() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ModelForm>(emptyModelForm);

  const modelsQuery = trpc.ai.models.list.useQuery();
  const createMutation = trpc.ai.models.create.useMutation({
    onSuccess: () => {
      utils.ai.models.list.invalidate();
      toast.success(t("ai.modelSaved"));
      closeDialog();
    },
    onError: (err) => toast.error(err.message || t("common.operationFailed")),
  });
  const updateMutation = trpc.ai.models.update.useMutation({
    onSuccess: () => {
      utils.ai.models.list.invalidate();
      toast.success(t("ai.modelSaved"));
      closeDialog();
    },
    onError: (err) => toast.error(err.message || t("common.operationFailed")),
  });
  const deleteMutation = trpc.ai.models.delete.useMutation({
    onSuccess: () => {
      utils.ai.models.list.invalidate();
      toast.success(t("common.delete"));
    },
    onError: (err) => toast.error(err.message || t("common.operationFailed")),
  });
  const testMutation = trpc.ai.models.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("ai.testSuccess", { model: result.model, latency: result.latencyMs }));
      } else {
        toast.error(t("ai.testFailed", { error: result.error }));
      }
    },
    onError: (err) => toast.error(t("ai.testFailed", { error: err.message })),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyModelForm);
  }

  function openEditDialog(model: NonNullable<typeof modelsQuery.data>[number]) {
    setEditingId(model.id);
    setForm({
      name: model.name,
      provider: model.provider as ModelForm["provider"],
      apiBaseUrl: model.apiBaseUrl,
      apiKey: "",
      modelName: model.modelName,
      maxTokens: model.maxTokens?.toString() ?? "",
      temperature: model.temperature ?? "",
      isDefault: model.isDefault,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      name: form.name,
      provider: form.provider,
      apiBaseUrl: form.apiBaseUrl,
      apiKey: form.apiKey || undefined,
      modelName: form.modelName,
      maxTokens: form.maxTokens ? parseInt(form.maxTokens, 10) : undefined,
      temperature: form.temperature || undefined,
      isDefault: form.isDefault,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      if (!form.apiKey) {
        toast.error("API Key is required");
        return;
      }
      createMutation.mutate(payload as Parameters<typeof createMutation.mutate>[0]);
    }
  }

  const models = modelsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-foreground">{t("ai.modelList")}</h2>
        <Button size="sm" onClick={() => { setForm(emptyModelForm); setEditingId(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          {t("ai.addModel")}
        </Button>
      </div>

      {models.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t("ai.noModels")}</p>
      ) : (
        <div className="space-y-2">
          {models.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.modelName}</span>
                    {m.isDefault && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">{m.apiKey}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => testMutation.mutate({ id: m.id })} disabled={testMutation.isPending}>
                  {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(m)}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate({ id: m.id })} disabled={deleteMutation.isPending}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Model Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("ai.editModel") : t("ai.addModel")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("ai.modelName")}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("ai.provider")}</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v as ModelForm["provider"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai_compatible">OpenAI Compatible</SelectItem>
                  <SelectItem value="google_gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>API Base URL</Label>
              <Input placeholder="https://api.deepseek.com/v1" value={form.apiBaseUrl} onChange={(e) => setForm((f) => ({ ...f, apiBaseUrl: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>API Key</Label>
              <Input type="password" placeholder={editingId ? t("ai.leaveEmptyToKeep") : ""} value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input placeholder="deepseek-chat" value={form.modelName} onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Max Tokens</Label>
                <Input type="number" placeholder="4096" value={form.maxTokens} onChange={(e) => setForm((f) => ({ ...f, maxTokens: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Temperature</Label>
                <Input placeholder="0.7" value={form.temperature} onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isDefault} onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v }))} />
              <Label className="text-sm">{t("ai.setAsDefault")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════
//  SearchPanel
// ══════════════════════════════════════════
function SearchPanel() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SearchConfigForm>(emptySearchConfigForm);

  const configsQuery = trpc.ai.searchConfigs.list.useQuery();
  const createMutation = trpc.ai.searchConfigs.create.useMutation({
    onSuccess: () => {
      utils.ai.searchConfigs.list.invalidate();
      toast.success(t("ai.searchConfigSaved"));
      closeDialog();
    },
    onError: (err) => toast.error(err.message || t("common.operationFailed")),
  });
  const deleteMutation = trpc.ai.searchConfigs.delete.useMutation({
    onSuccess: () => {
      utils.ai.searchConfigs.list.invalidate();
      toast.success(t("common.delete"));
    },
    onError: (err) => toast.error(err.message || t("common.operationFailed")),
  });
  const testMutation = trpc.ai.searchConfigs.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("ai.searchTestSuccess", { count: result.resultCount, latency: result.latencyMs }));
      } else {
        toast.error(t("ai.testFailed", { error: result.error }));
      }
    },
    onError: (err) => toast.error(t("ai.testFailed", { error: err.message })),
  });

  function closeDialog() {
    setDialogOpen(false);
    setForm(emptySearchConfigForm);
  }

  function handleSubmit() {
    if (!form.apiKey) {
      toast.error("API Key is required");
      return;
    }
    createMutation.mutate({
      name: form.name,
      provider: form.provider as "serper" | "serpapi" | "tavily" | "custom",
      apiBaseUrl: form.apiBaseUrl,
      apiKey: form.apiKey,
      isDefault: form.isDefault,
    });
  }

  const configs = configsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-foreground">{t("ai.searchServiceList")}</h2>
        <Button size="sm" onClick={() => { setForm(emptySearchConfigForm); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          {t("ai.addSearchConfig")}
        </Button>
      </div>

      {configs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t("ai.noSearchConfigs")}</p>
      ) : (
        <div className="space-y-2">
          {configs.map((c) => (
            <div
              key={c.id}
              className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.provider}</span>
                  {c.isDefault && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                </div>
                <span className="text-xs text-muted-foreground font-mono">{c.apiKey}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => testMutation.mutate({ id: c.id })} disabled={testMutation.isPending}>
                  {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate({ id: c.id })} disabled={deleteMutation.isPending}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Config Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ai.addSearchConfig")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("ai.serviceName")}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("ai.provider")}</Label>
              <Select
                value={form.provider}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, provider: v, apiBaseUrl: SEARCH_PROVIDER_DEFAULTS[v] ?? f.apiBaseUrl }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="serper">Serper</SelectItem>
                  <SelectItem value="serpapi">SerpAPI</SelectItem>
                  <SelectItem value="tavily">Tavily</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>API Base URL</Label>
              <Input value={form.apiBaseUrl} onChange={(e) => setForm((f) => ({ ...f, apiBaseUrl: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>API Key</Label>
              <Input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isDefault} onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v }))} />
              <Label className="text-sm">{t("ai.setAsDefault")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Doc status badge ──
const DOC_STATUS_STYLES: Record<string, string> = {
  ready: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// ══════════════════════════════════════════
//  KnowledgePanel
// ══════════════════════════════════════════
function KnowledgePanel() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [selectedKbId, setSelectedKbId] = useState<number | null>(null);
  const [kbForm, setKbForm] = useState<KnowledgeBaseForm>(emptyKbForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const kbQuery = trpc.ai.knowledgeBases.list.useQuery();
  const docsQuery = trpc.ai.knowledgeBases.listDocs.useQuery(
    { knowledgeBaseId: selectedKbId! },
    { enabled: selectedKbId !== null },
  );

  const createKbMutation = trpc.ai.knowledgeBases.create.useMutation({
    onSuccess: () => {
      utils.ai.knowledgeBases.list.invalidate();
      toast.success(t("ai.kbCreated"));
      setKbForm(emptyKbForm);
    },
    onError: (err) => toast.error(err.message || t("common.operationFailed")),
  });

  const deleteKbMutation = trpc.ai.knowledgeBases.delete.useMutation({
    onSuccess: () => {
      utils.ai.knowledgeBases.list.invalidate();
      if (selectedKbId) setSelectedKbId(null);
    },
    onError: (err) => toast.error(err.message || t("common.operationFailed")),
  });

  const uploadDocMutation = trpc.ai.knowledgeBases.uploadDoc.useMutation({
    onSuccess: () => {
      if (selectedKbId) utils.ai.knowledgeBases.listDocs.invalidate({ knowledgeBaseId: selectedKbId });
      toast.success(t("ai.docUploaded"));
    },
    onError: (err) => toast.error(err.message || t("common.operationFailed")),
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedKbId) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const ext = file.name.split(".").pop() ?? "";
      uploadDocMutation.mutate({
        knowledgeBaseId: selectedKbId,
        fileName: file.name,
        fileType: ext,
        fileSize: file.size,
        data: base64,
      });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = "";
  }

  const knowledgeBases = kbQuery.data ?? [];
  const docs = docsQuery.data ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left: KB list + create form */}
      <div className="space-y-4">
        <h2 className="text-base font-medium text-foreground">{t("ai.knowledgeBases")}</h2>

        {/* Create form */}
        <div className="space-y-2 p-3 rounded-lg border border-border">
          <Input
            placeholder={t("ai.kbName")}
            value={kbForm.name}
            onChange={(e) => setKbForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder={t("ai.kbDescription")}
            value={kbForm.description}
            onChange={(e) => setKbForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Button
            size="sm"
            className="w-full"
            disabled={!kbForm.name || createKbMutation.isPending}
            onClick={() => createKbMutation.mutate(kbForm)}
          >
            {createKbMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            {t("common.add")}
          </Button>
        </div>

        {/* KB list */}
        <div className="space-y-2">
          {knowledgeBases.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("ai.noModels")}</p>
          ) : (
            knowledgeBases.map((kb) => (
              <div
                key={kb.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedKbId === kb.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setSelectedKbId(kb.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{kb.name}</p>
                    {kb.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{kb.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteKbMutation.mutate({ id: kb.id }); }}
                    disabled={deleteKbMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Docs for selected KB */}
      <div className="space-y-4">
        <h2 className="text-base font-medium text-foreground">{t("ai.documents")}</h2>

        {selectedKbId === null ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t("ai.selectKb")}</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadDocMutation.isPending}>
                {uploadDocMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {t("ai.uploadDoc")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv"
                onChange={handleFileUpload}
              />
            </div>

            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("ai.noModels")}</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.fileSize != null ? `${(doc.fileSize / 1024).toFixed(1)} KB` : ""}
                      </p>
                    </div>
                    <Badge className={DOC_STATUS_STYLES[doc.status] ?? DOC_STATUS_STYLES.processing} variant="outline">
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  AIConfigPage
// ══════════════════════════════════════════
export default function AIConfigPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const canManage = user ? hasPermission(user, PERMISSIONS.MANAGE_AI_CONFIG) : false;

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">{t("common.noPermission")}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Brain className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">{t("ai.configTitle")}</h1>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-4 h-full">
          <Tabs defaultValue="models" className="h-full flex flex-col">
            <TabsList>
              <TabsTrigger value="models">
                <Brain className="w-4 h-4" />
                {t("ai.modelsTab")}
              </TabsTrigger>
              <TabsTrigger value="search">
                <Search className="w-4 h-4" />
                {t("ai.searchTab")}
              </TabsTrigger>
              <TabsTrigger value="knowledge">
                <BookOpen className="w-4 h-4" />
                {t("ai.knowledgeTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="models" className="mt-4 overflow-auto">
              <ModelsPanel />
            </TabsContent>
            <TabsContent value="search" className="mt-4 overflow-auto">
              <SearchPanel />
            </TabsContent>
            <TabsContent value="knowledge" className="mt-4 overflow-auto">
              <KnowledgePanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
