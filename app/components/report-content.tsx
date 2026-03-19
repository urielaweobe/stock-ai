import { Fragment, type ReactNode } from "react";
import { cn } from "~/lib/utils";

type ReportListType = "ul" | "ol";

const reportHeadingStyles: Record<number, string> = {
  1: "text-2xl font-semibold",
  2: "text-xl font-semibold",
  3: "text-lg font-semibold",
  4: "text-base font-semibold",
  5: "text-sm font-semibold",
  6: "text-sm font-semibold uppercase tracking-wide",
};

const renderHeading = (level: number, text: string, key: string) => {
  const className = reportHeadingStyles[level];
  const content = renderInlineMarkdown(text);

  switch (level) {
    case 1:
      return (
        <h1 key={key} className={className}>
          {content}
        </h1>
      );
    case 2:
      return (
        <h2 key={key} className={className}>
          {content}
        </h2>
      );
    case 3:
      return (
        <h3 key={key} className={className}>
          {content}
        </h3>
      );
    case 4:
      return (
        <h4 key={key} className={className}>
          {content}
        </h4>
      );
    case 5:
      return (
        <h5 key={key} className={className}>
          {content}
        </h5>
      );
    default:
      return (
        <h6 key={key} className={className}>
          {content}
        </h6>
      );
  }
};

export const renderInlineMarkdown = (text: string) => {
  const segments: ReactNode[] = [];
  let buffer = "";
  let isBold = false;
  let isItalic = false;

  const flushBuffer = () => {
    if (!buffer) {
      return;
    }

    let content: ReactNode = buffer;

    if (isItalic) {
      content = <em>{content}</em>;
    }

    if (isBold) {
      content = <strong className="font-semibold">{content}</strong>;
    }

    segments.push(
      <Fragment key={`segment-${segments.length}`}>{content}</Fragment>
    );
    buffer = "";
  };

  for (let index = 0; index < text.length; index++) {
    const currentCharacter = text[index];
    const nextCharacter = text[index + 1];

    if (currentCharacter === "*" && nextCharacter === "*") {
      flushBuffer();
      isBold = !isBold;
      index++;
      continue;
    }

    if (currentCharacter === "*") {
      flushBuffer();
      isItalic = !isItalic;
      continue;
    }

    buffer += currentCharacter;
  }

  flushBuffer();

  return segments;
};

export const renderReportContent = (report: string) => {
  const lines = report.replace(/\r\n/g, "\n").split("\n");
  const content: ReactNode[] = [];
  const paragraphLines: string[] = [];
  const listItems: string[] = [];
  let currentListType: ReportListType | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    const paragraph = paragraphLines.join(" ");
    content.push(
      <p key={`paragraph-${content.length}`} className="leading-7">
        {renderInlineMarkdown(paragraph)}
      </p>
    );
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (!currentListType || listItems.length === 0) {
      return;
    }

    const ListTag = currentListType;
    content.push(
      <ListTag
        key={`list-${content.length}`}
        className={cn(
          "ml-6 space-y-2",
          currentListType === "ul" ? "list-disc" : "list-decimal"
        )}
      >
        {listItems.map((item, index) => (
          <li key={`${currentListType}-item-${index}`} className="leading-7">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ListTag>
    );

    currentListType = null;
    listItems.length = 0;
  };

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      flushParagraph();
      flushList();

      const level = headingMatch[1].length;
      const headingText = headingMatch[2];

      content.push(renderHeading(level, headingText, `heading-${content.length}`));
      return;
    }

    const unorderedListMatch = trimmedLine.match(/^[-*]\s+(.*)$/);

    if (unorderedListMatch) {
      flushParagraph();

      if (currentListType && currentListType !== "ul") {
        flushList();
      }

      currentListType = "ul";
      listItems.push(unorderedListMatch[1]);
      return;
    }

    const orderedListMatch = trimmedLine.match(/^\d+\.\s+(.*)$/);

    if (orderedListMatch) {
      flushParagraph();

      if (currentListType && currentListType !== "ol") {
        flushList();
      }

      currentListType = "ol";
      listItems.push(orderedListMatch[1]);
      return;
    }

    flushList();
    paragraphLines.push(trimmedLine);
  });

  flushParagraph();
  flushList();

  return content;
};

interface ReportContentProps {
  report: string;
  className?: string;
}

export function ReportContent({ report, className }: ReportContentProps) {
  return (
    <div
      className={cn(
        "space-y-3 text-base break-words dark:text-gray-200",
        className
      )}
    >
      {renderReportContent(report)}
    </div>
  );
}
