import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText, Save, Trash2, Globe, Lock } from "lucide-react";
import { toast } from "sonner";

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadTemplate: (template: any) => void;
  currentItems: any[];
  discountRate: number;
  notes: string;
}

type DialogMode = "load" | "save";

export default function TemplateDialog({
  open, onOpenChange, onLoadTemplate, currentItems, discountRate, notes,
}: TemplateDialogProps) {
  const [mode, setMode] = useState<DialogMode>("load");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMode("load");
      setTemplateName("");
      setTemplateDescription("");
      setIsPublic(false);
    }
  }, [open]);

  // Fetch templates list
  const templatesQuery = trpc.templates.list.useQuery(undefined, {
    enabled: open,
  });

  // Mutations
  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      toast.success("模板保存成功");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(`保存失败: ${err.message}`);
    },
  });

  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      toast.success("模板已删除");
      templatesQuery.refetch();
    },
    onError: (err) => {
      toast.error(`删除失败: ${err.message}`);
    },
  });

  const handleSave = useCallback(() => {
    if (!templateName.trim()) {
      toast.error("请输入模板名称");
      return;
    }
    if (currentItems.length === 0) {
      toast.error("当前报价单没有产品项，无法保存为模板");
      return;
    }

    createMutation.mutate({
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
      isPublic,
      discountRate,
      notes: notes || undefined,
      items: JSON.stringify(currentItems),
    });
  }, [templateName, templateDescription, isPublic, currentItems, discountRate, notes, createMutation]);

  const handleLoad = useCallback((template: any) => {
    try {
      const items = typeof template.items === "string"
        ? JSON.parse(template.items)
        : template.items;
      onLoadTemplate({
        ...template,
        items,
      });
      toast.success(`已加载模板: ${template.name}`);
      onOpenChange(false);
    } catch {
      toast.error("模板数据解析失败");
    }
  }, [onLoadTemplate, onOpenChange]);

  const handleDelete = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteMutation.mutate({ id });
  }, [deleteMutation]);

  const templates = templatesQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>报价单模板管理</DialogTitle>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex border-b px-6">
          <button
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              mode === "load"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("load")}
          >
            <FileText className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            加载模板
          </button>
          <button
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              mode === "save"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("save")}
          >
            <Save className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            保存为模板
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-hidden">
          {mode === "load" ? (
            <div className="p-6 space-y-3">
              {templatesQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">加载模板列表...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">暂无可用模板</p>
                  <p className="text-xs mt-1">保存当前报价单为模板，方便以后复用</p>
                </div>
              ) : (
                templates.map((template: any) => {
                  let itemCount = 0;
                  try {
                    const items = typeof template.items === "string"
                      ? JSON.parse(template.items)
                      : template.items;
                    itemCount = Array.isArray(items) ? items.length : 0;
                  } catch {
                    itemCount = 0;
                  }

                  const createdDate = template.createdAt
                    ? new Date(template.createdAt).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    : "-";

                  return (
                    <Card
                      key={template.id}
                      className="cursor-pointer transition-colors hover:bg-accent/50 py-0 gap-0"
                      onClick={() => handleLoad(template)}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{template.name}</span>
                            {template.isPublic ? (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5">
                                <Globe className="w-2.5 h-2.5" />
                                公开
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                                <Lock className="w-2.5 h-2.5" />
                                私有
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] text-muted-foreground">
                              {itemCount} 个产品项
                            </span>
                            {template.discountRate !== undefined && template.discountRate !== null && (
                              <span className="text-[11px] text-muted-foreground">
                                折扣 {Number(template.discountRate)}%
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              创建于 {createdDate}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDelete(e, template.id)}
                          title="删除模板"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Template Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  模板名称 <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="输入模板名称"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  maxLength={256}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">模板描述</label>
                <Input
                  placeholder="可选：简要描述此模板用途"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  maxLength={512}
                />
              </div>

              {/* Public Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="text-sm font-medium">
                      {isPublic ? "公开模板" : "私有模板"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isPublic
                        ? "所有用户都可以查看和使用此模板"
                        : "仅自己可以查看和使用此模板"}
                    </div>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

              {/* Preview */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  保存预览
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">产品数量</span>
                    <p className="text-sm font-medium">{currentItems.length} 个产品项</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">当前折扣</span>
                    <p className="text-sm font-medium">{discountRate}%</p>
                  </div>
                  {notes && (
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">备注</span>
                      <p className="text-sm font-medium truncate">{notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-background shrink-0 gap-3">
          {mode === "save" && (
            <>
              <span className="text-xs text-muted-foreground">
                将保存 {currentItems.length} 个产品项
              </span>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
                  取消
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!templateName.trim() || currentItems.length === 0 || createMutation.isPending}
                  className="text-xs"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      保存中...
                    </>
                  ) : (
                    "保存模板"
                  )}
                </Button>
              </div>
            </>
          )}
          {mode === "load" && (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
                关闭
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
