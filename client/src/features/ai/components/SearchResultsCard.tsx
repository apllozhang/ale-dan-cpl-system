import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  date?: string;
};

type Props = {
  results: SearchResult[];
};

export function SearchResultsCard({ results }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  if (results.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            !open && "-rotate-90",
          )}
        />
        {t("ai.searchResults")} ({results.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 space-y-2">
        {results.map((result, index) => (
          <div
            key={index}
            className="rounded-md border border-border bg-muted/30 p-2.5 text-xs"
          >
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {result.title}
              <ExternalLink className="size-2.5" />
            </a>
            {result.date && (
              <span className="ml-2 text-muted-foreground">{result.date}</span>
            )}
            <p className="mt-1 leading-relaxed text-muted-foreground">
              {result.snippet}
            </p>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
