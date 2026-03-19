import { useEffect, useState } from "react";

interface UseStreamedReportOptions {
  content?: string;
  error?: string;
  isSubmitting: boolean;
  speed?: number;
}

export function useStreamedReport({
  content,
  error,
  isSubmitting,
  speed = 10,
}: UseStreamedReportOptions) {
  const [streamedReport, setStreamedReport] = useState("");
  const [streamFinished, setStreamFinished] = useState(false);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    setStreamedReport("");
    setStreamFinished(false);
  }, [isSubmitting]);

  useEffect(() => {
    if (content) {
      let index = 0;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      setStreamedReport("");
      setStreamFinished(false);

      const streamText = () => {
        if (index <= content.length) {
          setStreamedReport(content.slice(0, index));

          if (index === content.length) {
            setStreamFinished(true);
          }

          index++;
          timeoutId = setTimeout(streamText, speed);
        }
      };

      streamText();

      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }

    if (error) {
      setStreamedReport(error);
      setStreamFinished(true);
      return;
    }

    setStreamedReport("");
    setStreamFinished(false);
  }, [content, error, speed]);

  return { streamedReport, streamFinished };
}
